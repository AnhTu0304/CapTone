import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { createMigratorPool } from '../config/database';

export const MIGRATION_ADVISORY_LOCK_KEY = '847291045123';

export interface RunMigrationsOptions {
  migrationsDir?: string;
  seedsDir?: string;
  pool?: Pool;
  baseline?: boolean;
  baselineThrough?: string;
  seed?: boolean;
  exitOnComplete?: boolean;
}

export interface RunMigrationsResult {
  applied: string[];
  skipped: string[];
  baselined: string[];
  seeded: string[];
}

export function normalizeSqlForChecksum(sql: string): string {
  return sql.replace(/\r\n/g, '\n');
}

export function computeSqlChecksum(sql: string): string {
  return crypto.createHash('sha256').update(normalizeSqlForChecksum(sql), 'utf8').digest('hex');
}

export function isNonTransactionalMigration(sql: string): boolean {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  if (/^\s*--\s*no-transaction\b/im.test(sql)) {
    return true;
  }
  return /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(withoutComments);
}

async function ensureSchemaMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      checksum_sha256 VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'BASELINE', 'FAILED')),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function resolveDefaultDir(subDir: 'migrations' | 'seeds'): string {
  const possibleDirs = [
    path.resolve(__dirname, `../../${subDir}`),
    path.resolve(__dirname, `../../../${subDir}`),
  ];
  return (
    possibleDirs.find(
      (d) => fs.existsSync(d) && fs.readdirSync(d).some((f) => f.endsWith('.sql'))
    ) || possibleDirs[0]
  );
}

export async function runMigrations(
  options: RunMigrationsOptions = {}
): Promise<RunMigrationsResult> {
  const ownsPool = !options.pool;
  const activePool = options.pool || createMigratorPool();
  const migrationsDir = options.migrationsDir || resolveDefaultDir('migrations');
  const seedsDir = options.seedsDir || resolveDefaultDir('seeds');
  const baseline = Boolean(options.baseline || options.baselineThrough);
  const baselineThrough = options.baselineThrough;
  const seed = Boolean(options.seed);

  console.log('🔄 Đang đọc thư mục migration tại:', migrationsDir);

  if (!fs.existsSync(migrationsDir)) {
    if (ownsPool) await activePool.end().catch(() => {});
    throw new Error(`Không tìm thấy thư mục migration: ${migrationsDir}`);
  }

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const result: RunMigrationsResult = {
    applied: [],
    skipped: [],
    baselined: [],
    seeded: [],
  };

  if (sqlFiles.length === 0) {
    console.log('⚠️ Không tìm thấy file migration (.sql) nào trong thư mục.');
    if (ownsPool) await activePool.end().catch(() => {});
    return result;
  }

  const lockClient = await activePool.connect();
  let lockHeld = false;

  try {
    console.log('✅ Đã kết nối cơ sở dữ liệu PostgreSQL (đang xin pg_advisory_lock).');
    await lockClient.query(`SELECT pg_advisory_lock($1::bigint)`, [MIGRATION_ADVISORY_LOCK_KEY]);
    lockHeld = true;

    await ensureSchemaMigrationsTable(lockClient);

    const existingRes = await lockClient.query<{
      filename: string;
      checksum_sha256: string;
      status: string;
    }>(`SELECT filename, checksum_sha256, status FROM schema_migrations`);
    const ledger = new Map(existingRes.rows.map((r) => [r.filename, r]));

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const checksum = computeSqlChecksum(sqlContent);
      const recorded = ledger.get(file);

      if (recorded && (recorded.status === 'SUCCESS' || recorded.status === 'BASELINE')) {
        if (recorded.checksum_sha256 !== checksum) {
          throw new Error(
            `Checksum mismatch for already-applied migration '${file}' (recorded=${recorded.checksum_sha256}, actual=${checksum}). Refusing to proceed.`
          );
        }
        console.log(`⏭️ Bỏ qua migration đã áp dụng: ${file} (${recorded.status})`);
        result.skipped.push(file);
        continue;
      }

      const shouldBaselineFile =
        baseline && (!baselineThrough || file.localeCompare(baselineThrough) <= 0);

      if (shouldBaselineFile) {
        await lockClient.query(
          `INSERT INTO schema_migrations (filename, checksum_sha256, status, applied_at, execution_ms)
           VALUES ($1, $2, 'BASELINE', NOW(), 0)
           ON CONFLICT (filename) DO UPDATE
           SET checksum_sha256 = EXCLUDED.checksum_sha256,
               status = 'BASELINE',
               applied_at = NOW(),
               execution_ms = 0`,
          [file, checksum]
        );
        console.log(`📌 Đã baseline migration: ${file}`);
        result.baselined.push(file);
        continue;
      }

      const startMs = Date.now();
      const nonTx = isNonTransactionalMigration(sqlContent);
      console.log(`🚀 Đang thực thi migration${nonTx ? ' (non-transactional)' : ''}: ${file}...`);

      if (nonTx) {
        try {
          await lockClient.query(sqlContent);
          const duration = Date.now() - startMs;
          await lockClient.query(
            `INSERT INTO schema_migrations (filename, checksum_sha256, status, applied_at, execution_ms)
             VALUES ($1, $2, 'SUCCESS', NOW(), $3)
             ON CONFLICT (filename) DO UPDATE
             SET checksum_sha256 = EXCLUDED.checksum_sha256,
                 status = 'SUCCESS',
                 applied_at = NOW(),
                 execution_ms = EXCLUDED.execution_ms`,
            [file, checksum, duration]
          );
        } catch (err) {
          await lockClient
            .query(
              `INSERT INTO schema_migrations (filename, checksum_sha256, status, applied_at, execution_ms)
               VALUES ($1, $2, 'FAILED', NOW(), $3)
               ON CONFLICT (filename) DO UPDATE
               SET status = 'FAILED', applied_at = NOW(), execution_ms = EXCLUDED.execution_ms`,
              [file, checksum, Date.now() - startMs]
            )
            .catch(() => {});
          throw err;
        }
      } else {
        await lockClient.query('BEGIN');
        try {
          await lockClient.query(sqlContent);
          const duration = Date.now() - startMs;
          await lockClient.query(
            `INSERT INTO schema_migrations (filename, checksum_sha256, status, applied_at, execution_ms)
             VALUES ($1, $2, 'SUCCESS', NOW(), $3)
             ON CONFLICT (filename) DO UPDATE
             SET checksum_sha256 = EXCLUDED.checksum_sha256,
                 status = 'SUCCESS',
                 applied_at = NOW(),
                 execution_ms = EXCLUDED.execution_ms`,
            [file, checksum, duration]
          );
          await lockClient.query('COMMIT');
        } catch (err) {
          await lockClient.query('ROLLBACK').catch(() => {});
          await lockClient
            .query(
              `INSERT INTO schema_migrations (filename, checksum_sha256, status, applied_at, execution_ms)
               VALUES ($1, $2, 'FAILED', NOW(), $3)
               ON CONFLICT (filename) DO UPDATE
               SET status = 'FAILED', applied_at = NOW(), execution_ms = EXCLUDED.execution_ms`,
              [file, checksum, Date.now() - startMs]
            )
            .catch(() => {});
          throw err;
        }
      }

      console.log(`✅ Hoàn tất migration: ${file}`);
      result.applied.push(file);
    }

    if (seed && !baseline) {
      if (!fs.existsSync(seedsDir)) {
        throw new Error(`Không tìm thấy thư mục seed khi truyền cờ --seed: ${seedsDir}`);
      }
      const seedFiles = fs
        .readdirSync(seedsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const seedFile of seedFiles) {
        const seedSql = fs.readFileSync(path.join(seedsDir, seedFile), 'utf8');
        console.log(`🌱 Đang chạy idempotent seed: ${seedFile}...`);
        await lockClient.query('BEGIN');
        try {
          await lockClient.query(seedSql);
          await lockClient.query('COMMIT');
        } catch (err) {
          await lockClient.query('ROLLBACK').catch(() => {});
          throw err;
        }
        result.seeded.push(seedFile);
      }
    }

    console.log('🎉 Toàn bộ quy trình migration cơ sở dữ liệu đã hoàn tất an toàn!');
    return result;
  } finally {
    if (lockHeld) {
      await lockClient
        .query(`SELECT pg_advisory_unlock($1::bigint)`, [MIGRATION_ADVISORY_LOCK_KEY])
        .catch(() => {});
    }
    lockClient.release();
    if (ownsPool) {
      await activePool.end().catch(() => {});
    }
  }
}

function parseCliArgs(argv: string[]): RunMigrationsOptions {
  const baseline = argv.includes('--baseline');
  const baselineThroughArg = argv.find((a) => a.startsWith('--baseline-through='));
  const seed = argv.includes('--seed');
  const migArg = argv.find((a) => a.startsWith('--migrations-dir='));
  const seedArg = argv.find((a) => a.startsWith('--seeds-dir='));
  return {
    baseline,
    seed,
    ...(baselineThroughArg ? { baselineThrough: baselineThroughArg.split('=')[1] } : {}),
    ...(migArg ? { migrationsDir: path.resolve(migArg.split('=')[1]) } : {}),
    ...(seedArg ? { seedsDir: path.resolve(seedArg.split('=')[1]) } : {}),
  };
}

if (require.main === module) {
  runMigrations(parseCliArgs(process.argv.slice(2)))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Lỗi khi thực thi migration:', (error as Error).message);
      process.exit(1);
    });
}
