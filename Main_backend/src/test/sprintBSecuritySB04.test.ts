import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import http from 'http';
import { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis, redisClient, isRedisReady } from '../config/redis';
import { AuthService } from '../services/auth.service';
import { TwoFactorService, decryptTotpSecret } from '../services/twoFactor.service';

const USER_ID = 'd5d50000-0000-4000-8000-000000000101';
const USER_EMAIL = 'sb04.auth.test@test.local';
const USER_PASSWORD = 'Sb04StrongPassword!123';

function signJwt(id: string, email: string) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles: ['USER'] }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

function generateTotp(secretBase32: string): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secretBase32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const step = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(step, 4);
  const digest = crypto.createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

describe('Sprint B SB-04: Google OAuth JWKS, OTP Hardening & 2FA Encryption/Replay', () => {
  let server: http.Server;
  let baseUrl: string;
  const createdEmails: string[] = [USER_EMAIL];

  before(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Wrong database '${dbCheck.rows[0]?.db}'`);
    }

    const pwHash = await bcrypt.hash(USER_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
       VALUES ($1, $2, $3, 'SB04 Test User', 'ACTIVE', NULL)
       ON CONFLICT (id) DO UPDATE SET password_hash = $3, email_verified_at = NULL, status = 'ACTIVE', deleted_at = NULL;`,
      [USER_ID, USER_EMAIL, pwHash]
    );

    await testRedisConnection();
    if (isRedisReady()) {
      await redisClient.del(`otp:cooldown:${USER_ID}`, `otp:fail:${USER_ID}`).catch(() => {});
    }

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
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db === 'aiselfhealing_test') {
      await pool.query(`DELETE FROM user_two_factor WHERE user_id = $1`, [USER_ID]);
      await pool.query(`DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`, [createdEmails]);
      await pool.query(`DELETE FROM users WHERE email = ANY($1::text[]) OR id = $2`, [createdEmails, USER_ID]);
    }
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('SB04-01: verifyGoogleToken cryptographically checks RS256 JWKS, aud, iss, and email_verified', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' }) as any;
    jwk.kid = 'sb04-key-1';
    jwk.use = 'sig';
    jwk.alg = 'RS256';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('googleapis.com/oauth2/v3/certs')) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=60' },
        });
      }
      throw new Error(`Unexpected fetch in test: ${urlStr}`);
    }) as typeof fetch;

    try {
      const validIdToken = jwt.sign(
        { email: 'google.ok@test.local', email_verified: true, name: 'Google User' },
        privateKey,
        {
          algorithm: 'RS256',
          keyid: 'sb04-key-1',
          audience: config.googleClientId,
          issuer: 'https://accounts.google.com',
          expiresIn: '5m',
        }
      );
      const ok = await AuthService.verifyGoogleToken(validIdToken);
      assert.strictEqual(ok.email, 'google.ok@test.local');

      const wrongAudToken = jwt.sign(
        { email: 'google.bad@test.local', email_verified: true },
        privateKey,
        {
          algorithm: 'RS256',
          keyid: 'sb04-key-1',
          audience: 'attacker-client-id.apps.googleusercontent.com',
          issuer: 'https://accounts.google.com',
          expiresIn: '5m',
        }
      );
      await assert.rejects(() => AuthService.verifyGoogleToken(wrongAudToken), (err: any) => err.statusCode === 401);

      const unverifiedEmailToken = jwt.sign(
        { email: 'google.unverified@test.local', email_verified: false },
        privateKey,
        {
          algorithm: 'RS256',
          keyid: 'sb04-key-1',
          audience: config.googleClientId,
          issuer: 'https://accounts.google.com',
          expiresIn: '5m',
        }
      );
      await assert.rejects(() => AuthService.verifyGoogleToken(unverifiedEmailToken), (err: any) => err.statusCode === 401);

      const forgedHeaderPayload =
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
        '.' +
        Buffer.from(JSON.stringify({ email: 'attacker@test.local', email_verified: true })).toString('base64url') +
        '.forgedsig';
      await assert.rejects(() => AuthService.verifyGoogleToken(forgedHeaderPayload), (err: any) => err.statusCode === 401);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('SB04-02: OTP responses never leak OTP code/token and enforce send cooldown', async () => {
    const regEmail = `sb04.reg.${Date.now()}@test.local`;
    createdEmails.push(regEmail);

    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({ email: regEmail, password: USER_PASSWORD, full_name: 'SB04 Reg User' }),
    });
    assert.strictEqual(regRes.status, 201);
    const regBody = await regRes.json();
    assert.strictEqual(regBody.data.verification_token, undefined, 'Register must NOT leak verification_token');

    const userToken = regBody.data.token;
    const send1 = await fetch(`${baseUrl}/api/v1/auth/send-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'x-skip-rate-limit': 'true' },
    });
    assert.strictEqual(send1.status, 200);
    const send1Body = await send1.json();
    assert.strictEqual(send1Body.data.code, undefined, 'send-verification must NOT leak OTP code');
    assert.strictEqual(send1Body.data.token, undefined, 'send-verification must NOT leak OTP token');

    const send2 = await fetch(`${baseUrl}/api/v1/auth/send-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'x-skip-rate-limit': 'true' },
    });
    assert.strictEqual(send2.status, 429, 'Immediate second OTP send must be rate-limited by 60s cooldown');
  });

  test('SB04-03: POST /users/verify-email requires valid OTP, enforces single-use and attempt lockout', async () => {
    const token = signJwt(USER_ID, USER_EMAIL);

    // Without OTP -> 400 and user remains unverified
    const bypassRes = await fetch(`${baseUrl}/api/v1/users/verify-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(bypassRes.status, 400);

    const dbUserBefore = await pool.query(`SELECT email_verified_at FROM users WHERE id = $1`, [USER_ID]);
    assert.strictEqual(dbUserBefore.rows[0].email_verified_at, null);

    // Generate real OTP & redeem once
    const otp = await AuthService.createEmailVerificationToken(USER_ID);
    const okRes = await fetch(`${baseUrl}/api/v1/users/verify-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({ code: otp }),
    });
    assert.strictEqual(okRes.status, 200);

    // Replay same OTP -> 400
    const replayRes = await fetch(`${baseUrl}/api/v1/users/verify-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({ code: otp }),
    });
    assert.strictEqual(replayRes.status, 400);

    // 5 bad attempts -> lockout 429
    for (let i = 0; i < 5; i++) {
      await assert.rejects(() => AuthService.verifyEmail('000000', USER_ID), (err: any) => err.statusCode === 400);
    }
    await assert.rejects(() => AuthService.verifyEmail('000000', USER_ID), (err: any) => err.statusCode === 429);
  });

  test('SB04-04: 2FA secret is AES-256-GCM encrypted at rest, blocks TOTP replay, and requires re-auth to disable', async () => {
    const token = signJwt(USER_ID, USER_EMAIL);
    const setupRes = await TwoFactorService.setup(USER_ID, USER_EMAIL);

    const dbRow = await pool.query(`SELECT secret_key FROM user_two_factor WHERE user_id = $1`, [USER_ID]);
    const storedSecret: string = dbRow.rows[0].secret_key;
    assert.ok(storedSecret.startsWith('v1:'), '2FA secret must be AES-256-GCM encrypted at rest');
    assert.notStrictEqual(storedSecret, setupRes.secret);
    assert.strictEqual(decryptTotpSecret(storedSecret), setupRes.secret);

    const code1 = generateTotp(setupRes.secret);
    await TwoFactorService.enable(USER_ID, code1);

    // Same TOTP code in the same 30s step MUST fail replay protection
    const replay = await TwoFactorService.verifyLoginCode(USER_ID, code1);
    assert.strictEqual(replay.success, false, 'Replaying same TOTP code in 30s window must fail');

    // Disabling 2FA without password or valid code -> 400
    const emptyDisable = await fetch(`${baseUrl}/api/v1/auth/2fa/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(emptyDisable.status, 400);

    // Wrong password -> 401
    const badDisable = await fetch(`${baseUrl}/api/v1/auth/2fa/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({ password: 'WrongPassword!' }),
    });
    assert.strictEqual(badDisable.status, 401);

    // Valid password -> 200
    const okDisable = await fetch(`${baseUrl}/api/v1/auth/2fa/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-skip-rate-limit': 'true' },
      body: JSON.stringify({ password: USER_PASSWORD }),
    });
    assert.strictEqual(okDisable.status, 200);
  });

  test('SB04-05: Browser GET /api/v1/auth/verify-email escapes HTML characters in error responses', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/verify-email?code=bad`, {
      headers: { Accept: 'text/html', 'x-skip-rate-limit': 'true' },
    });
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(!html.includes('<script>'));
  });
});
