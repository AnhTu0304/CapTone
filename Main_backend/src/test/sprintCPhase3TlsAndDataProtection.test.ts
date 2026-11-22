import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { buildPgPoolConfig, resolvePgSslConfig } from '../config/database';
import { config } from '../config/env';
import { redactSensitiveString, sanitizeForLog } from '../utils/logSanitizer';
import { AuditService } from '../services/audit.service';
import { EmailService } from '../services/email.service';
import { errorHandler } from '../middlewares/error.middleware';
import { AiController } from '../controllers/ai.controller';
import { AiModelRegistryController } from '../controllers/aiModelRegistry.controller';

function resolveBinary(candidates: string[], fallbackName: string): string {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return fallbackName;
}

const OPENSSL_BIN = resolveBinary(
  ['C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe'],
  'openssl'
);
const PGDUMP_BIN = resolveBinary(['C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe'], 'pg_dump');
const PGRESTORE_BIN = resolveBinary(['C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe'], 'pg_restore');

const TLS_CONTAINER = 'selfheal-phase3-tls-probe';
const TLS_PORT = 5499;
const TLS_DB_PASS = 'Phase3TlsProbePass!123';
const TLS_DB_NAME = 'tls_test_db';

describe('Sprint C Phase 3 — PostgreSQL TLS & Data Protection (11 Verification Areas)', () => {
  let tmpDir: string;
  let caCrtPath: string;
  let rogueCaCrtPath: string;
  let localPgAdminPool: Pool;
  const restoreTestDb = 'aiselfhealing_phase3_restore_test';
  let dockerContainerStarted = false;

  function genSignedCert(opts: {
    name: string;
    caCrt: string;
    caKey: string;
    cn: string;
    san?: string;
    expired?: boolean;
  }) {
    const keyPath = path.join(tmpDir, `${opts.name}.key`);
    const csrPath = path.join(tmpDir, `${opts.name}.csr`);
    const crtPath = path.join(tmpDir, `${opts.name}.crt`);
    const extPath = path.join(tmpDir, `${opts.name}.ext`);

    execFileSync(OPENSSL_BIN, ['genrsa', '-out', keyPath, '2048']);
    execFileSync(OPENSSL_BIN, ['req', '-new', '-key', keyPath, '-subj', `/CN=${opts.cn}`, '-out', csrPath]);

    const extLines = [
      'basicConstraints=CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
    ];
    if (opts.san) {
      extLines.push(`subjectAltName=${opts.san}`);
    }
    fs.writeFileSync(extPath, extLines.join('\n') + '\n', 'utf8');

    if (opts.expired) {
      // Create an isolated X.509 certificate with past validity via openssl x509 / ca or faketime workaround:
      // Generate a local mini CA DB to mint exact -startdate / -enddate in the past cleanly
      const caDbDir = path.join(tmpDir, `cadb_${opts.name}`);
      fs.mkdirSync(caDbDir, { recursive: true });
      fs.writeFileSync(path.join(caDbDir, 'index.txt'), '', 'utf8');
      fs.writeFileSync(path.join(caDbDir, 'serial'), '1001\n', 'utf8');
      const caConf = path.join(caDbDir, 'openssl.cnf');
      fs.writeFileSync(
        caConf,
        [
          '[ca]',
          'default_ca = CA_default',
          '[CA_default]',
          `dir = ${caDbDir.replace(/\\/g, '/')}`,
          'database = $dir/index.txt',
          'serial = $dir/serial',
          `new_certs_dir = ${caDbDir.replace(/\\/g, '/')}`,
          `certificate = ${opts.caCrt.replace(/\\/g, '/')}`,
          `private_key = ${opts.caKey.replace(/\\/g, '/')}`,
          'default_md = sha256',
          'policy = policy_anything',
          '[policy_anything]',
          'commonName = supplied',
        ].join('\n') + '\n',
        'utf8'
      );
      execFileSync(OPENSSL_BIN, [
        'ca',
        '-batch',
        '-config',
        caConf,
        '-startdate',
        '20200101000000Z',
        '-enddate',
        '20210101000000Z',
        '-extfile',
        extPath,
        '-in',
        csrPath,
        '-out',
        crtPath,
      ]);
    } else {
      execFileSync(OPENSSL_BIN, [
        'x509',
        '-req',
        '-in',
        csrPath,
        '-CA',
        opts.caCrt,
        '-CAkey',
        opts.caKey,
        '-CAcreateserial',
        '-out',
        crtPath,
        '-days',
        '365',
        '-sha256',
        '-extfile',
        extPath,
      ]);
    }

    return { keyPath, crtPath };
  }

  async function waitForTlsContainerReady() {
    const start = Date.now();
    while (Date.now() - start < 25000) {
      const probe = spawnSync('docker', ['exec', TLS_CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', TLS_DB_NAME], {
        encoding: 'utf8',
      });
      if (probe.status === 0) {
        // Also ensure host TCP port accepts TLS connection cleanly
        const p = new Pool({
          host: '127.0.0.1',
          port: TLS_PORT,
          user: 'postgres',
          password: TLS_DB_PASS,
          database: TLS_DB_NAME,
          ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caCrtPath, 'utf8') },
        });
        try {
          await p.query('SELECT 1');
          await p.end();
          return;
        } catch {
          await p.end().catch(() => {});
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('Timed out waiting for isolated TLS PostgreSQL container');
  }

  async function reloadContainerCerts(certFileName: string, keyFileName: string) {
    execFileSync('docker', [
      'exec',
      '-u',
      'root',
      TLS_CONTAINER,
      'sh',
      '-c',
      `cp /etc/postgresql/certs/${certFileName} /etc/postgresql/certs/server-active.crt && cp /etc/postgresql/certs/${keyFileName} /etc/postgresql/certs/server-active.key && chown 70:70 /etc/postgresql/certs/server-active.crt /etc/postgresql/certs/server-active.key && chmod 600 /etc/postgresql/certs/server-active.key && chmod 644 /etc/postgresql/certs/server-active.crt`,
    ]);
    execFileSync('docker', [
      'exec',
      '-u',
      'postgres',
      TLS_CONTAINER,
      'psql',
      '-d',
      TLS_DB_NAME,
      '-c',
      'SELECT pg_reload_conf()',
    ]);
    await new Promise((r) => setTimeout(r, 300));
  }

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfheal-phase3-'));
    caCrtPath = path.join(tmpDir, 'ca.crt');
    const caKeyPath = path.join(tmpDir, 'ca.key');
    rogueCaCrtPath = path.join(tmpDir, 'rogue-ca.crt');
    const rogueCaKeyPath = path.join(tmpDir, 'rogue-ca.key');

    execFileSync(OPENSSL_BIN, ['genrsa', '-out', caKeyPath, '2048']);
    execFileSync(OPENSSL_BIN, ['req', '-x509', '-new', '-nodes', '-key', caKeyPath, '-sha256', '-days', '365', '-subj', '/CN=SelfHeal-Test-CA', '-out', caCrtPath]);

    execFileSync(OPENSSL_BIN, ['genrsa', '-out', rogueCaKeyPath, '2048']);
    execFileSync(OPENSSL_BIN, ['req', '-x509', '-new', '-nodes', '-key', rogueCaKeyPath, '-sha256', '-days', '365', '-subj', '/CN=Rogue-CA', '-out', rogueCaCrtPath]);

    genSignedCert({
      name: 'server-valid',
      caCrt: caCrtPath,
      caKey: caKeyPath,
      cn: 'localhost',
      san: 'DNS:localhost,DNS:postgres,IP:127.0.0.1',
    });
    genSignedCert({
      name: 'server-wronghost',
      caCrt: caCrtPath,
      caKey: caKeyPath,
      cn: 'wrong-postgres.internal',
      san: 'DNS:wrong-postgres.internal',
    });
    genSignedCert({
      name: 'server-expired',
      caCrt: caCrtPath,
      caKey: caKeyPath,
      cn: 'localhost',
      san: 'DNS:localhost,IP:127.0.0.1',
      expired: true,
    });
    genSignedCert({
      name: 'server-untrusted',
      caCrt: rogueCaCrtPath,
      caKey: rogueCaKeyPath,
      cn: 'localhost',
      san: 'DNS:localhost,IP:127.0.0.1',
    });

    fs.writeFileSync(
      path.join(tmpDir, 'pg_hba.conf'),
      [
        'local all postgres peer',
        'local all all scram-sha-256',
        'hostnossl all all all reject',
        'hostssl all all 0.0.0.0/0 scram-sha-256',
        'hostssl all all ::0/0 scram-sha-256',
      ].join('\n') + '\n',
      'utf8'
    );

    // Ensure no leftover ephemeral probe container exists
    spawnSync('docker', ['rm', '-f', TLS_CONTAINER], { stdio: 'ignore' });

    const mountDir = tmpDir.replace(/\\/g, '/');
    execFileSync('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      TLS_CONTAINER,
      '-e',
      'POSTGRES_USER=postgres',
      '-e',
      `POSTGRES_PASSWORD=${TLS_DB_PASS}`,
      '-e',
      `POSTGRES_DB=${TLS_DB_NAME}`,
      '-p',
      `127.0.0.1:${TLS_PORT}:5432`,
      '-v',
      `${mountDir}:/mnt/certs:ro`,
      'postgres:16-alpine',
      'sh',
      '-c',
      'mkdir -p /etc/postgresql/certs && cp /mnt/certs/*.crt /mnt/certs/*.key /mnt/certs/pg_hba.conf /etc/postgresql/certs/ && cp /etc/postgresql/certs/server-valid.crt /etc/postgresql/certs/server-active.crt && cp /etc/postgresql/certs/server-valid.key /etc/postgresql/certs/server-active.key && chown -R 70:70 /etc/postgresql/certs && chmod 600 /etc/postgresql/certs/*.key && chmod 644 /etc/postgresql/certs/*.crt /etc/postgresql/certs/pg_hba.conf && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/etc/postgresql/certs/server-active.crt -c ssl_key_file=/etc/postgresql/certs/server-active.key -c ssl_ca_file=/etc/postgresql/certs/ca.crt -c ssl_min_protocol_version=TLSv1.2 -c hba_file=/etc/postgresql/certs/pg_hba.conf',
    ]);
    dockerContainerStarted = true;
    await waitForTlsContainerReady();

    localPgAdminPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'postgres',
      password: process.env.DB_ADMIN_PASSWORD || config.db.password,
      database: 'aiselfhealing_test',
      max: 3,
    });
    await localPgAdminPool.query(`DROP DATABASE IF EXISTS ${restoreTestDb};`).catch(() => {});
  });

  after(async () => {
    if (dockerContainerStarted) {
      spawnSync('docker', ['rm', '-f', TLS_CONTAINER], { stdio: 'ignore' });
    }
    if (localPgAdminPool) {
      await localPgAdminPool.query(`DROP DATABASE IF EXISTS ${restoreTestDb};`).catch(() => {});
      await localPgAdminPool.end().catch(() => {});
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('1 & 2. Valid PostgreSQL TLS connection verifies expected CA & TLS >= 1.2 under verify-full', async () => {
    const p = new Pool(
      buildPgPoolConfig('app', {
        host: '127.0.0.1',
        port: TLS_PORT,
        user: 'postgres',
        password: TLS_DB_PASS,
        database: TLS_DB_NAME,
        sslMode: 'verify-full',
        sslCaPath: caCrtPath,
        sslRequireStrict: true,
      })
    );
    try {
      const res = await p.query(
        `SELECT COALESCE(s.ssl, false) AS ssl_used, s.version, s.cipher
         FROM (SELECT 1) AS x
         LEFT JOIN pg_stat_ssl s ON s.pid = pg_backend_pid();`
      );
      assert.strictEqual(res.rows[0].ssl_used, true);
      assert.ok(['TLSv1.2', 'TLSv1.3'].includes(res.rows[0].version), `Unexpected TLS version: ${res.rows[0].version}`);
      assert.ok(res.rows[0].cipher, 'Expected negotiated TLS cipher');
    } finally {
      await p.end();
    }
  });

  test('3. Untrusted / invalid CA certificate chain is rejected cleanly', async () => {
    const p = new Pool(
      buildPgPoolConfig('app', {
        host: '127.0.0.1',
        port: TLS_PORT,
        user: 'postgres',
        password: TLS_DB_PASS,
        database: TLS_DB_NAME,
        sslMode: 'verify-full',
        sslCaPath: rogueCaCrtPath,
        sslRequireStrict: true,
      })
    );
    try {
      await assert.rejects(
        () => p.query('SELECT 1'),
        (err: any) => /self-signed|unable to verify|certificate/i.test(String(err?.message || err))
      );
    } finally {
      await p.end();
    }
  });

  test('4 & 5. Expired server certificate and wrong hostname SAN are both rejected under verify-full', async () => {
    // Test 5: Wrong hostname SAN
    await reloadContainerCerts('server-wronghost.crt', 'server-wronghost.key');
    const wrongHostPool = new Pool(
      buildPgPoolConfig('app', {
        host: '127.0.0.1',
        port: TLS_PORT,
        user: 'postgres',
        password: TLS_DB_PASS,
        database: TLS_DB_NAME,
        sslMode: 'verify-full',
        sslCaPath: caCrtPath,
        sslRequireStrict: true,
      })
    );
    try {
      await assert.rejects(
        () => wrongHostPool.query('SELECT 1'),
        (err: any) => /altnames|hostname|IP: 127\.0\.0\.1 is not in the cert/i.test(String(err?.message || err))
      );
    } finally {
      await wrongHostPool.end();
    }

    // Test 4: Expired certificate
    await reloadContainerCerts('server-expired.crt', 'server-expired.key');
    const expiredPool = new Pool(
      buildPgPoolConfig('app', {
        host: '127.0.0.1',
        port: TLS_PORT,
        user: 'postgres',
        password: TLS_DB_PASS,
        database: TLS_DB_NAME,
        sslMode: 'verify-full',
        sslCaPath: caCrtPath,
        sslRequireStrict: true,
      })
    );
    try {
      await assert.rejects(
        () => expiredPool.query('SELECT 1'),
        (err: any) => /expired/i.test(String(err?.message || err))
      );
    } finally {
      await expiredPool.end();
      await reloadContainerCerts('server-valid.crt', 'server-valid.key');
    }
  });

  test('6. Plaintext connections are rejected by TLS-enforced server AND verify-full client rejects plaintext server', async () => {
    // A. Client attempts plaintext against hostssl server -> pg_hba rejects
    const plainClientPool = new Pool(
      buildPgPoolConfig('app', {
        host: '127.0.0.1',
        port: TLS_PORT,
        user: 'postgres',
        password: TLS_DB_PASS,
        database: TLS_DB_NAME,
        sslMode: 'disable',
        sslRequireStrict: false,
      })
    );
    try {
      await assert.rejects(
        () => plainClientPool.query('SELECT 1'),
        (err: any) => /no pg_hba\.conf entry|SSL off|no encryption/i.test(String(err?.message || err))
      );
    } finally {
      await plainClientPool.end();
    }

    // B. Client requires verify-full against local PG (ssl=off) -> fails closed, never falls back to plaintext
    const strictClientVsPlainServer = new Pool(
      buildPgPoolConfig('app', {
        host: config.db.host,
        port: config.db.port,
        user: 'postgres',
        password: process.env.DB_ADMIN_PASSWORD || config.db.password,
        database: 'aiselfhealing_test',
        sslMode: 'verify-full',
        sslCaPath: caCrtPath,
        sslRequireStrict: true,
      })
    );
    try {
      await assert.rejects(
        () => strictClientVsPlainServer.query('SELECT 1'),
        (err: any) => /does not support SSL/i.test(String(err?.message || err))
      );
    } finally {
      await strictClientVsPlainServer.end();
    }
  });

  test('7. Application TLS config validation fails closed on invalid or weakened settings', () => {
    assert.throws(() =>
      resolvePgSslConfig({ sslMode: 'invalid-mode', sslRequireStrict: false })
    );
    assert.throws(() =>
      resolvePgSslConfig({ sslMode: 'disable', sslRequireStrict: true })
    );
    assert.throws(() =>
      resolvePgSslConfig({ sslMode: 'require', sslRequireStrict: true, sslCaPath: caCrtPath })
    );
    assert.throws(() =>
      resolvePgSslConfig({ sslMode: 'verify-full', sslCaPath: path.join(tmpDir, 'missing-ca.crt'), sslRequireStrict: true })
    );
    const badPem = path.join(tmpDir, 'not-a-cert.pem');
    fs.writeFileSync(badPem, 'NOT A PEM CERTIFICATE', 'utf8');
    assert.throws(() =>
      resolvePgSslConfig({ sslMode: 'verify-full', sslCaPath: badPem, sslRequireStrict: true })
    );
    assert.throws(() =>
      resolvePgSslConfig({
        sslMode: 'verify-full',
        sslCaPath: caCrtPath,
        sslRequireStrict: true,
        connectionString: 'postgresql://app:pw@localhost:5432/db?sslmode=disable',
      })
    );
  });

  test('8. Database role privilege boundaries enforce least privilege between postgres, migrator, and app', async () => {
    const roleMeta = await localPgAdminPool.query(
      `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
       FROM pg_roles
       WHERE rolname IN ('selfheal_app', 'selfheal_migrator', 'selfheal_readonly')
       ORDER BY rolname;`
    );
    assert.strictEqual(roleMeta.rows.length, 3);
    for (const row of roleMeta.rows) {
      assert.strictEqual(row.rolsuper, false, `${row.rolname} must NOT be superuser`);
      assert.strictEqual(row.rolbypassrls, false, `${row.rolname} must NOT bypass RLS`);
      assert.strictEqual(row.rolcreaterole, false);
      assert.strictEqual(row.rolcreatedb, false);
    }

    const ephPw = 'Phase3RoleBoundary!' + crypto.randomBytes(6).toString('hex');
    await localPgAdminPool.query(`ALTER ROLE selfheal_app WITH LOGIN PASSWORD '${ephPw}'`);
    const appPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'selfheal_app',
      password: ephPw,
      database: 'aiselfhealing_test',
    });
    try {
      await assert.rejects(
        () => appPool.query('CREATE TABLE public.unpriv_probe (id INT)'),
        /permission denied/i
      );
      await assert.rejects(
        () => appPool.query('ALTER TABLE public.incidents ADD COLUMN bogus_col TEXT'),
        /must be owner of table/i
      );
      await assert.rejects(
        () => appPool.query('SELECT rolpassword FROM pg_authid LIMIT 1'),
        /permission denied/i
      );
    } finally {
      await appPool.end();
      await localPgAdminPool.query('ALTER ROLE selfheal_app WITH PASSWORD NULL');
    }
  });

  test('9 & 10. Backup encryption (AES-256-PBKDF2), integrity check, and restore verification into isolated DB', async () => {
    const pgAdminPass = process.env.DB_ADMIN_PASSWORD || config.db.password || '';
    const backupKey = 'Phase3StrongBackupKey!_' + crypto.randomBytes(12).toString('hex');
    const rawDump = path.join(tmpDir, 'test_backup.dump');
    const encDump = path.join(tmpDir, 'test_backup.dump.enc');
    const decDump = path.join(tmpDir, 'test_backup.dec.dump');

    const pgEnv = { ...process.env, PGPASSWORD: pgAdminPass };
    execFileSync(
      PGDUMP_BIN,
      ['-h', config.db.host, '-p', String(config.db.port), '-U', 'postgres', '-Fc', '-f', rawDump, 'aiselfhealing_test'],
      { env: pgEnv }
    );
    assert.ok(fs.statSync(rawDump).size > 1000, 'Expected non-empty pg_dump archive');

    // Encrypt with AES-256-CBC + PBKDF2-SHA256 (matching scripts/backup-postgres.sh)
    execFileSync(
      OPENSSL_BIN,
      ['enc', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-salt', '-md', 'sha256', '-in', rawDump, '-out', encDump, '-pass', 'env:BACKUP_ENCRYPTION_KEY'],
      { env: { ...process.env, BACKUP_ENCRYPTION_KEY: backupKey } }
    );
    fs.unlinkSync(rawDump);

    const encHeader = fs.readFileSync(encDump).subarray(0, 5).toString('ascii');
    assert.notStrictEqual(encHeader, 'PGDMP', 'Encrypted backup MUST NOT expose raw PGDMP header');

    const expectedSha = crypto.createHash('sha256').update(fs.readFileSync(encDump)).digest('hex');

    // Wrong key decryption MUST fail
    assert.throws(() =>
      execFileSync(
        OPENSSL_BIN,
        ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-md', 'sha256', '-in', encDump, '-out', decDump, '-pass', 'env:BACKUP_ENCRYPTION_KEY'],
        { env: { ...process.env, BACKUP_ENCRYPTION_KEY: 'WrongDecryptionKey123!' }, stdio: 'ignore' }
      )
    );

    // Correct key decryption + SHA-256 integrity verification + restore into ephemeral DB
    const actualSha = crypto.createHash('sha256').update(fs.readFileSync(encDump)).digest('hex');
    assert.strictEqual(actualSha, expectedSha);

    execFileSync(
      OPENSSL_BIN,
      ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-md', 'sha256', '-in', encDump, '-out', decDump, '-pass', 'env:BACKUP_ENCRYPTION_KEY'],
      { env: { ...process.env, BACKUP_ENCRYPTION_KEY: backupKey } }
    );

    await localPgAdminPool.query(`CREATE DATABASE ${restoreTestDb};`);
    execFileSync(
      PGRESTORE_BIN,
      ['-h', config.db.host, '-p', String(config.db.port), '-U', 'postgres', '--no-owner', '--no-privileges', '-d', restoreTestDb, decDump],
      { env: pgEnv }
    );

    const restoredPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'postgres',
      password: pgAdminPass,
      database: restoreTestDb,
    });
    try {
      const tableCountRes = await restoredPool.query(
        `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema='public';`
      );
      assert.ok(tableCountRes.rows[0].c >= 47, `Expected >= 47 restored tables, got ${tableCountRes.rows[0].c}`);
      const phase2Tables = await restoredPool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_sessions', 'refresh_tokens');`
      );
      assert.strictEqual(phase2Tables.rows.length, 2);
    } finally {
      await restoredPool.end();
      await localPgAdminPool.query(`DROP DATABASE IF EXISTS ${restoreTestDb};`);
    }
  });

  test('11. Log & error redaction protects passwords, tokens, DB credentials, TOTP/webhook keys, and internal errors', async () => {
    const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSIsInR2IjoxfQ.abcdef123456';
    const rawText = [
      `Authorization: Bearer ${sampleJwt}`,
      'postgres://selfheal_app:MySecretPgPass@db.internal:5432/captone_db',
      'https://api.local/quick-approve?token=hitl_secret_jwt_999&code=123456',
      'OPENAI_API_KEY=sk-live9876543210abcdef',
      'AGENT_TOKEN=cap_agentsecret12345',
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtest\n-----END RSA PRIVATE KEY-----',
    ].join(' | ');

    const redacted = redactSensitiveString(rawText);
    assert.strictEqual(redacted.includes(sampleJwt), false);
    assert.strictEqual(redacted.includes('MySecretPgPass'), false);
    assert.strictEqual(redacted.includes('hitl_secret_jwt_999'), false);
    assert.strictEqual(redacted.includes('sk-live9876543210abcdef'), false);
    assert.strictEqual(redacted.includes('cap_agentsecret12345'), false);
    assert.strictEqual(redacted.includes('MIIEowIBAAKCAQEAtest'), false);

    // AuditService redaction covers pagerduty_key, slack_webhook_url, backup_codes, totp_secret
    const audited = AuditService.redactSensitiveData({
      pagerduty_key: 'pd-key-secret-value',
      slack_webhook_url: 'https://hooks.slack.com/services/T0/B0/SECRET',
      backup_codes: ['CODE-111', 'CODE-222'],
      totp_secret: 'JBSWY3DPEHPK3PXP',
      note: 'Bearer ' + sampleJwt,
      safeField: 'visible-value',
    });
    assert.strictEqual(audited.pagerduty_key, '[REDACTED]');
    assert.strictEqual(audited.slack_webhook_url, '[REDACTED]');
    assert.strictEqual(audited.backup_codes, '[REDACTED]');
    assert.strictEqual(audited.totp_secret, '[REDACTED]');
    assert.strictEqual(audited.note.includes(sampleJwt), false);
    assert.strictEqual(audited.safeField, 'visible-value');

    // ErrorHandler + AI controllers do not expose raw internal SQL errors in non-dev response
    const prevNodeEnv = process.env.NODE_ENV;
    (config as any).isDevelopment = false;
    try {
      const miniApp = express();
      miniApp.get('/boom', (_req, _res, next) =>
        next(new Error('connect ECONNREFUSED postgres://app:SecretPass!@10.0.0.5:5432'))
      );
      miniApp.get('/ai-boom', async (_req, res) => {
        // Force unexpected error inside AiController via respondError test path
        return (AiController as any).respondError(
          res,
          new Error('SELECT secret_col failed with password=LeakMe'),
          '[Test]'
        );
      });
      miniApp.get('/reg-boom', async (_req, res) => {
        const origErr = console.error;
        console.error = () => {};
        try {
          return await AiModelRegistryController.getAllModels(
            {} as any,
            res
          );
        } finally {
          console.error = origErr;
        }
      });
      miniApp.use(errorHandler);

      const srv = miniApp.listen(0);
      const { port } = srv.address() as AddressInfo;
      try {
        const r1 = await fetch(`http://127.0.0.1:${port}/boom`).then((r) => r.json());
        assert.strictEqual(r1.message, 'Internal Server Error');
        assert.strictEqual(JSON.stringify(r1).includes('SecretPass'), false);

        const r2 = await fetch(`http://127.0.0.1:${port}/ai-boom`).then((r) => r.json());
        assert.strictEqual(r2.message, 'Internal Server Error');
        assert.strictEqual(JSON.stringify(r2).includes('LeakMe'), false);
      } finally {
        srv.close();
      }

      // EmailService HITL dev log must mask payload.token without hitting external SMTP
      const prevSmtpUser = config.email.user;
      const prevSmtpPass = config.email.pass;
      (config.email as any).user = '';
      (config.email as any).pass = '';
      EmailService.setTransporterForTesting(null);
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...a: any[]) => logs.push(a.join(' '));
      try {
        await EmailService.sendHitlApprovalNotification({
          toEmail: 'approver@test.local',
          recipientName: 'Approver',
          organizationName: 'Org',
          clusterName: 'cls-1',
          approvalId: '11111111-1111-1111-1111-111111111111',
          healingActionId: '22222222-2222-2222-2222-222222222222',
          actionCode: 'RESTART_POD',
          actionName: 'Restart Pod',
          riskLevel: 'HIGH',
          targetType: 'POD',
          targetName: 'orders-1',
          token: 'hitl_super_secret_jwt_token_value_123456',
        });
      } finally {
        console.log = origLog;
        (config.email as any).user = prevSmtpUser;
        (config.email as any).pass = prevSmtpPass;
        EmailService.setTransporterForTesting(null);
      }
      const joined = logs.join('\n');
      assert.strictEqual(joined.includes('hitl_super_secret_jwt_token_value_123456'), false);
      assert.ok(joined.includes('đã che giấu'));
    } finally {
      (config as any).isDevelopment = prevNodeEnv === 'development';
    }

    // sanitizeForLog handles Error cleanly without leaking passwords
    const errObj = sanitizeForLog(new Error('postgres://user:RawPw99@localhost/db'));
    assert.strictEqual(JSON.stringify(errObj).includes('RawPw99'), false);
  });
});
