import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { testRedisConnection, closeRedis } from '../config/redis';
import { AuditRetentionService } from '../services/auditRetention.service';

describe('Audit Log Data Retention & Archival Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = '9a000000-0000-0000-0000-000000000001';
  const adminId = '9a000000-0000-0000-0000-000000000002';
  const regularUserId = '9a000000-0000-0000-0000-000000000003';

  let superAdminToken: string;
  let adminToken: string;
  let regularUserToken: string;

  before(async () => {
    await testRedisConnection();

    // 1. Seed Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'retention.super@test.com', 'dummy_hash', 'Retention Super', 'ACTIVE', NOW(), NOW()),
         ($2, 'retention.admin@test.com', 'dummy_hash', 'Retention Admin', 'ACTIVE', NOW(), NOW()),
         ($3, 'retention.user@test.com', 'dummy_hash', 'Retention User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [superAdminId, adminId, regularUserId]
    );

    // 2. Assign System Roles
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN')`);
    const superRoleId = srRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    const adminRoleId = srRes.rows.find((r) => r.name === 'ADMIN')?.id;

    if (superRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [superAdminId, superRoleId]);
    }
    if (adminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [adminId, adminRoleId]);
    }

    // 3. Generate JWT Tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'retention.super@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    adminToken = jwt.sign(
      { id: adminId, email: 'retention.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    regularUserToken = jwt.sign(
      { id: regularUserId, email: 'retention.user@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 4. Seed Test Audit Logs (Some old > 90 days, some recent)
    const oldDate1 = new Date();
    oldDate1.setDate(oldDate1.getDate() - 120);

    const oldDate2 = new Date();
    oldDate2.setDate(oldDate2.getDate() - 100);

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);

    await pool.query(
      `INSERT INTO audit_logs (user_id, actor_type, action, resource_type, status, description, created_at)
       VALUES 
         ($1, 'USER', 'OLD_LOG_1', 'TEST', 'SUCCESS', 'Test log 120 days old', $2),
         ($1, 'USER', 'OLD_LOG_2', 'TEST', 'SUCCESS', 'Test log 100 days old', $3),
         ($1, 'USER', 'RECENT_LOG', 'TEST', 'SUCCESS', 'Test log 5 days old', $4);`,
      [superAdminId, oldDate1, oldDate2, recentDate]
    );

    // 5. Start Server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Clean test seeded logs
    await pool.query(`DELETE FROM audit_logs WHERE action IN ('OLD_LOG_1', 'OLD_LOG_2', 'RECENT_LOG', 'SYSTEM_AUDIT_PURGED');`);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id IN ($1, $2, $3);`, [superAdminId, adminId, regularUserId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [superAdminId, adminId, regularUserId]);
    await closeRedis();
    await pool.end();
  });

  test('1. getRetentionDays returns integer >= 1', () => {
    const days = AuditRetentionService.getRetentionDays();
    assert.ok(typeof days === 'number');
    assert.ok(days >= 1);
  });

  test('2. getRetentionStats accurately detects logs older than 90 days', async () => {
    const stats = await AuditRetentionService.getRetentionStats(90);
    assert.ok(stats.totalLogs >= 3);
    assert.ok(stats.logsOlderThanRetention >= 2);
    assert.strictEqual(stats.retentionDays, 90);
    assert.ok(stats.cutoffDate instanceof Date);
  });

  test('3. purgeOldLogs in dryRun mode reports counts without deleting', async () => {
    const res = await AuditRetentionService.purgeOldLogs({
      retentionDays: 90,
      dryRun: true,
    });
    assert.ok(res.purgedCount >= 2);
    assert.strictEqual(res.batchesExecuted, 0);

    // Verify records still exist in DB
    const checkRes = await pool.query(`SELECT id FROM audit_logs WHERE action IN ('OLD_LOG_1', 'OLD_LOG_2');`);
    assert.strictEqual(checkRes.rows.length, 2);
  });

  test('4. purgeOldLogs deletes logs older than cutoff while keeping recent logs', async () => {
    const res = await AuditRetentionService.purgeOldLogs({
      retentionDays: 90,
      dryRun: false,
      batchSize: 1, // Test batching
    });
    assert.ok(res.purgedCount >= 2);
    assert.ok(res.batchesExecuted >= 2);

    // Old logs must be gone
    const oldCheck = await pool.query(`SELECT id FROM audit_logs WHERE action IN ('OLD_LOG_1', 'OLD_LOG_2');`);
    assert.strictEqual(oldCheck.rows.length, 0);

    // Recent log must still be present
    const recentCheck = await pool.query(`SELECT id FROM audit_logs WHERE action = 'RECENT_LOG';`);
    assert.strictEqual(recentCheck.rows.length, 1);
  });

  test('5. GET /api/v1/audit-logs/retention/stats requires authentication (401)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit-logs/retention/stats`);
    assert.strictEqual(res.status, 401);
  });

  test('6. GET /api/v1/audit-logs/retention/stats blocks regular user (403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit-logs/retention/stats`, {
      headers: { Authorization: `Bearer ${regularUserToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('7. GET /api/v1/audit-logs/retention/stats allows Admin (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit-logs/retention/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.ok(body.data.retentionDays >= 1);
    assert.ok(typeof body.data.totalLogs === 'number');
  });

  test('8. POST /api/v1/audit-logs/retention/purge blocks Admin (SuperAdmin only - 403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit-logs/retention/purge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('9. POST /api/v1/audit-logs/retention/purge allows SuperAdmin (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit-logs/retention/purge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.purgedCount === 'number');
  });
});
