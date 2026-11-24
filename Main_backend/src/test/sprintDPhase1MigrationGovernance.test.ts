import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Intentionally import planned runner API from scripts/migrate (TDD RED before implementation)
import * as migrateModule from '../scripts/migrate';

const TEST_DB_NAME = 'aiselfhealing_sprintd_gov_test';

function createAdminPool(database: string = 'postgres') {
  return new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database,
  });
}

describe('Sprint D Phase 1 (SD-01): Database Governance & Migration Safety', () => {
  let adminPool: Pool;
  let testPool: Pool;
  let tmpRoot: string;

  before(async () => {
    adminPool = createAdminPool('postgres');
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    testPool = createAdminPool(TEST_DB_NAME);
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'selfheal-sd01-'));
  });

  after(async () => {
    if (testPool) await testPool.end().catch(() => {});
    if (adminPool) {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [TEST_DB_NAME]
      ).catch(() => {});
      await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`).catch(() => {});
      await adminPool.end().catch(() => {});
    }
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('1. Executes migrations in order, records schema_migrations ledger, and skips re-runs', async () => {
    const runMigrations = (migrateModule as any).runMigrations;
    assert.strictEqual(typeof runMigrations, 'function', 'migrate.ts must export runMigrations');

    const migDir = path.join(tmpRoot, 'case1');
    fs.mkdirSync(migDir, { recursive: true });
    fs.writeFileSync(
      path.join(migDir, '01_create_items.sql'),
      `CREATE TABLE sd01_items (id SERIAL PRIMARY KEY, val TEXT NOT NULL);
       INSERT INTO sd01_items (val) VALUES ('once');`
    );
    fs.writeFileSync(
      path.join(migDir, '02_add_col.sql'),
      `ALTER TABLE sd01_items ADD COLUMN note TEXT DEFAULT 'ok';`
    );

    const first = await runMigrations({ migrationsDir: migDir, pool: testPool, exitOnComplete: false });
    assert.deepStrictEqual(first.applied, ['01_create_items.sql', '02_add_col.sql']);

    const second = await runMigrations({ migrationsDir: migDir, pool: testPool, exitOnComplete: false });
    assert.deepStrictEqual(second.applied, []);
    assert.deepStrictEqual(second.skipped, ['01_create_items.sql', '02_add_col.sql']);

    const rowsRes = await testPool.query(`SELECT val, note FROM sd01_items`);
    assert.strictEqual(rowsRes.rows.length, 1);
    assert.strictEqual(rowsRes.rows[0].note, 'ok');

    const ledgerRes = await testPool.query(
      `SELECT filename, checksum_sha256, status FROM schema_migrations ORDER BY filename`
    );
    assert.strictEqual(ledgerRes.rows.length, 2);
    assert.strictEqual(ledgerRes.rows[0].status, 'SUCCESS');
    assert.match(ledgerRes.rows[0].checksum_sha256, /^[a-f0-9]{64}$/);
  });

  test('2. Detects checksum mismatch on modified applied migration (fail-closed)', async () => {
    const runMigrations = (migrateModule as any).runMigrations;
    const migDir = path.join(tmpRoot, 'case1');
    fs.writeFileSync(
      path.join(migDir, '01_create_items.sql'),
      `CREATE TABLE sd01_items (id SERIAL PRIMARY KEY, val TEXT NOT NULL);
       INSERT INTO sd01_items (val) VALUES ('tampered');`
    );

    await assert.rejects(
      () => runMigrations({ migrationsDir: migDir, pool: testPool, exitOnComplete: false }),
      /checksum mismatch/i
    );
  });

  test('3. Rolls back failed transactional migration completely and supports -- no-transaction', async () => {
    const runMigrations = (migrateModule as any).runMigrations;
    const txDir = path.join(tmpRoot, 'case_tx');
    fs.mkdirSync(txDir, { recursive: true });

    fs.writeFileSync(
      path.join(txDir, '10_partial_fail.sql'),
      `CREATE TABLE sd01_should_rollback (id INT PRIMARY KEY);
       INSERT INTO non_existent_table_xyz VALUES (1);`
    );

    await assert.rejects(
      () => runMigrations({ migrationsDir: txDir, pool: testPool, exitOnComplete: false })
    );

    const existsRes = await testPool.query(`SELECT to_regclass('public.sd01_should_rollback') AS tbl`);
    assert.strictEqual(existsRes.rows[0].tbl, null, 'Failed TX migration must rollback partial DDL');

    // Now test -- no-transaction directive using ALTER SYSTEM or DISCARD or CONCURRENTLY
    fs.rmSync(path.join(txDir, '10_partial_fail.sql'));
    fs.writeFileSync(
      path.join(txDir, '11_concurrent_idx.sql'),
      `-- no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sd01_items_val ON sd01_items (val);`
    );

    const nonTxRes = await runMigrations({ migrationsDir: txDir, pool: testPool, exitOnComplete: false });
    assert.ok(nonTxRes.applied.includes('11_concurrent_idx.sql'));
  });

  test('4. Serializes concurrent migration processes with PostgreSQL advisory lock', async () => {
    const runMigrations = (migrateModule as any).runMigrations;
    const concDir = path.join(tmpRoot, 'case_conc');
    fs.mkdirSync(concDir, { recursive: true });
    fs.writeFileSync(
      path.join(concDir, '20_concurrent_counter.sql'),
      `CREATE TABLE IF NOT EXISTS sd01_conc_runs (id SERIAL PRIMARY KEY, ran_at TIMESTAMPTZ DEFAULT NOW());
       SELECT pg_sleep(0.15);
       INSERT INTO sd01_conc_runs DEFAULT VALUES;`
    );

    const [r1, r2] = await Promise.all([
      runMigrations({ migrationsDir: concDir, pool: testPool, exitOnComplete: false }),
      runMigrations({ migrationsDir: concDir, pool: testPool, exitOnComplete: false }),
    ]);

    const totalApplied = r1.applied.length + r2.applied.length;
    assert.strictEqual(totalApplied, 1, 'Exactly one concurrent runner should execute the migration');

    const countRes = await testPool.query(`SELECT count(*)::int AS cnt FROM sd01_conc_runs`);
    assert.strictEqual(countRes.rows[0].cnt, 1);
  });

  test('5. --baseline records existing migrations without executing SQL or mutating existing rows', async () => {
    const runMigrations = (migrateModule as any).runMigrations;
    const baseDir = path.join(tmpRoot, 'case_baseline');
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, '30_destructive_if_run.sql'),
      `TRUNCATE TABLE sd01_items; INSERT INTO sd01_items (val) VALUES ('overwritten');`
    );

    const baseRes = await runMigrations({
      migrationsDir: baseDir,
      pool: testPool,
      baseline: true,
      exitOnComplete: false,
    });
    assert.ok(baseRes.baselined.includes('30_destructive_if_run.sql'));

    const rowsRes = await testPool.query(`SELECT val FROM sd01_items`);
    assert.strictEqual(rowsRes.rows.length, 1);
    assert.strictEqual(rowsRes.rows[0].val, 'once', 'Baseline must not execute SQL or touch data');

    const ledgerRes = await testPool.query(
      `SELECT status FROM schema_migrations WHERE filename = '30_destructive_if_run.sql'`
    );
    assert.strictEqual(ledgerRes.rows[0].status, 'BASELINE');

    // Subsequent normal run skips baselined file
    const normalRes = await runMigrations({ migrationsDir: baseDir, pool: testPool, exitOnComplete: false });
    assert.strictEqual(normalRes.applied.length, 0);
    assert.ok(normalRes.skipped.includes('30_destructive_if_run.sql'));
  });

  test('6. 00_init_full_database.sql has no admin password overwrite and seeds preserve rotated credentials', async () => {
    const initSqlPath = path.resolve(__dirname, '../../migrations/00_init_full_database.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    assert.ok(
      !/ON CONFLICT\s*\(\s*email\s*\)\s*DO UPDATE/i.test(initSql),
      '00_init_full_database.sql must not overwrite user/admin credentials on conflict'
    );
    assert.ok(
      !/AdminPassword123@/i.test(initSql),
      '00_init_full_database.sql must not contain hardcoded AdminPassword123@ seed password'
    );
    assert.ok(
      !/cpt_sec_demo_token_2026_change_me/i.test(initSql),
      '00_init_full_database.sql must not embed demo agent tokens'
    );

    const seedPath = path.resolve(__dirname, '../../seeds/01_dev_demo_seed.sql');
    assert.strictEqual(fs.existsSync(seedPath), true, 'Main_backend/seeds/01_dev_demo_seed.sql must exist');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    assert.ok(
      !/ON CONFLICT\s*\(\s*email\s*\)\s*DO UPDATE/i.test(seedSql),
      'Seed file must not overwrite existing admin passwords'
    );

    // Run schema + seed on a dedicated clean DB to verify admin password preservation
    const seedDb = `${TEST_DB_NAME}_seed`;
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [seedDb]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${seedDb}`);
    await adminPool.query(`CREATE DATABASE ${seedDb}`);
    const seedPool = createAdminPool(seedDb);
    try {
      await seedPool.query(initSql);
      await seedPool.query(seedSql);
      await seedPool.query(
        `UPDATE users SET password_hash = '$2b$10$ROTATED_CUSTOM_ADMIN_HASH_NEVER_OVERWRITE' WHERE email = 'superadmin@selfheal.com'`
      );
      await seedPool.query(seedSql);
      const checkRes = await seedPool.query(
        `SELECT password_hash FROM users WHERE email = 'superadmin@selfheal.com'`
      );
      assert.strictEqual(
        checkRes.rows[0]?.password_hash,
        '$2b$10$ROTATED_CUSTOM_ADMIN_HASH_NEVER_OVERWRITE',
        'Re-running seed must preserve rotated admin password'
      );
    } finally {
      await seedPool.end().catch(() => {});
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [seedDb]
      ).catch(() => {});
      await adminPool.query(`DROP DATABASE IF EXISTS ${seedDb}`).catch(() => {});
    }
  });
});
