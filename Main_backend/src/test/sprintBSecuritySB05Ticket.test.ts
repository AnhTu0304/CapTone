import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { initTelemetryWebSocket } from '../websocket/telemetryWebSocket';

const ORG_A = 'e5e50000-0000-4000-8000-000000000001';
const USER_A = 'e5e50000-0000-4000-8000-000000000101';

function signJwt(id: string, email: string) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles: ['USER'] }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Sprint B SB-05: Single-Use WebSocket Ticket Authentication', () => {
  let server: http.Server;
  let uiWss: ReturnType<typeof initTelemetryWebSocket>;
  let baseUrl: string;
  let wsBaseUrl: string;

  before(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Wrong database '${dbCheck.rows[0]?.db}'`);
    }
    await testRedisConnection();

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES ($1, 'sb05.ws@test.local', 'hash', 'SB05 WS User', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [USER_A]
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status)
       VALUES ($1, 'SB05 Org A', 'sb05-org-a', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ORG_A]
    );
    const roleRes = await pool.query(`SELECT id FROM organization_roles WHERE code = 'DEVOPS' LIMIT 1`);
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING;`,
      [ORG_A, USER_A, roleRes.rows[0].id]
    );

    server = http.createServer(app);
    uiWss = initTelemetryWebSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsBaseUrl = `ws://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db === 'aiselfhealing_test') {
      await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_A]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG_A]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [USER_A]);
    }
    if (uiWss) uiWss.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('SB05-01: Unauthenticated POST /auth/ws-ticket returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/ws-ticket`, { method: 'POST' });
    assert.strictEqual(res.status, 401);
  });

  test('SB05-02: Valid single-use ticket authenticates WS and cannot be replayed', async () => {
    const token = signJwt(USER_A, 'sb05.ws@test.local');
    const ticketRes = await fetch(`${baseUrl}/api/v1/auth/ws-ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(ticketRes.status, 200);
    const ticketBody = await ticketRes.json();
    const ticket = ticketBody.data?.ticket;
    assert.ok(ticket && ticket.length >= 64);

    // First connection using ?ticket=... must succeed
    const initialMsg = await new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?ticket=${encodeURIComponent(ticket)}&organization_id=${ORG_A}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('WS ticket timeout'));
      }, 4000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'initial_state') {
          clearTimeout(timer);
          ws.close();
          resolve(msg);
        }
      });
    });
    assert.strictEqual(initialMsg.type, 'initial_state');

    // Second connection reusing same ticket must be rejected (unexpected-response 401)
    const replayStatus = await new Promise<number>((resolve) => {
      const ws2 = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?ticket=${encodeURIComponent(ticket)}&organization_id=${ORG_A}`);
      ws2.on('unexpected-response', (_req, res) => resolve(res.statusCode || 401));
      ws2.on('close', () => resolve(401));
      ws2.on('open', () => {
        ws2.close();
        resolve(200);
      });
    });
    assert.strictEqual(replayStatus, 401);
  });
});
