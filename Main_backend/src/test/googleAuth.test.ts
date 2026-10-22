import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import app from '../app';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { AuthService } from '../services/auth.service';

describe('Google OAuth API Suite (/api/v1/auth/google)', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}/api/v1/auth/google`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query("DELETE FROM users WHERE email = 'google_test_user@gmail.com'");
    await redisClient.quit().catch(() => {});
    await pool.end();
  });

  test('1. POST /api/v1/auth/google without token returns 400', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Vui lòng cung cấp mã xác thực Google/i);
  });

  test('2. POST /api/v1/auth/google with invalid token returns 401', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid_dummy_token_xyz' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Xác thực Google không thành công/i);
  });

  test('3. POST /api/v1/auth/google with valid token registers or logs in user', async () => {
    const originalVerify = AuthService.verifyGoogleToken;
    AuthService.verifyGoogleToken = async () => ({
      email: 'google_test_user@gmail.com',
      name: 'Google Test User',
      picture: 'https://example.com/photo.jpg',
    });

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'mock_valid_google_token' }),
      });
      const body = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.user.email, 'google_test_user@gmail.com');
      assert.ok(body.data.token, 'Should return JWT token');
    } finally {
      AuthService.verifyGoogleToken = originalVerify;
    }
  });
});
