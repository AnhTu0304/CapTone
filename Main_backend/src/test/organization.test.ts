import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { RedisCacheService } from '../services/redisCache.service';

describe('Organization API CRUD, Status Lock/Unlock & Redis Cache Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  // Test Fixture User IDs
  const superAdminId = 'e1000000-0000-0000-0000-000000000001';
  const ownerId = 'e1000000-0000-0000-0000-000000000002';
  const memberId = 'e1000000-0000-0000-0000-000000000003';
  const outsiderId = 'e1000000-0000-0000-0000-000000000004';

  let superAdminToken: string;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let createdOrgId: string;
  let createdOrgSlug: string;

  before(async () => {
    // 1. Ensure test users exist in database
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'org.superadmin@test.com', 'dummy_hash', 'Org SuperAdmin', 'ACTIVE', NOW(), NOW()),
        ($2, 'org.owner@test.com', 'dummy_hash', 'Org Owner', 'ACTIVE', NOW(), NOW()),
        ($3, 'org.member@test.com', 'dummy_hash', 'Org Member', 'ACTIVE', NOW(), NOW()),
        ($4, 'org.outsider@test.com', 'dummy_hash', 'Org Outsider', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [superAdminId, ownerId, memberId, outsiderId]);

    // Ensure system roles
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'USER')`);
    const superAdminRoleId = srRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    const userRoleId = srRes.rows.find((r) => r.name === 'USER')?.id;

    if (superAdminRoleId) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, superAdminRoleId]
      );
    }
    if (userRoleId) {
      for (const uid of [ownerId, memberId, outsiderId]) {
        await pool.query(
          `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [uid, userRoleId]
        );
      }
    }

    // 2. Generate JWT tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'org.superadmin@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerToken = jwt.sign(
      { id: ownerId, email: 'org.owner@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    memberToken = jwt.sign(
      { id: memberId, email: 'org.member@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    outsiderToken = jwt.sign(
      { id: outsiderId, email: 'org.outsider@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 3. Start HTTP test server
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
    // Clean up created test organizations
    if (createdOrgId) {
      await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [createdOrgId]);
      await pool.query(`DELETE FROM organization_profiles WHERE organization_id = $1`, [createdOrgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [createdOrgId]);
    }
    await pool.end();
    await closeRedis();
  });

  const requestApi = async (
    path: string,
    options: { method?: string; token?: string; body?: any } = {}
  ) => {
    const { method = 'GET', token, body } = options;
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // not json
    }

    return { status: res.status, headers: res.headers, data };
  };

  // ==========================================
  // 1. [2.8] & [2.9] POST TẠO ORGANIZATION & SINH ORG ID
  // ==========================================
  describe('1. Organization Creation & ID Generation ([2.8] & [2.9])', () => {
    test('1.1. POST /api/v1/organizations creates new org, assigns SME_OWNER, and generates UUID', async () => {
      const res = await requestApi('/api/v1/organizations', {
        method: 'POST',
        token: ownerToken,
        body: {
          name: 'Acme SelfHeal Corp',
          type: 'TECHNOLOGY',
          description: 'Automated self-healing infrastructure tenant',
          email: 'contact@acme-selfheal.com',
          website: 'https://acme-selfheal.com',
          city: 'Da Nang',
          country: 'Vietnam',
        },
      });

      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      assert.strictEqual(res.data?.success, true);
      const org = res.data?.data;
      assert.ok(org?.id, 'Organization ID must exist');
      assert.strictEqual(org.name, 'Acme SelfHeal Corp');
      assert.strictEqual(org.status, 'ACTIVE');
      assert.strictEqual(org.role_in_org, 'SME_OWNER', 'Creator must be assigned SME_OWNER');
      assert.ok(org.slug, 'Slug must be automatically generated');
      assert.ok(org.profile, 'Profile must be created');
      assert.strictEqual(org.profile.email, 'contact@acme-selfheal.com');

      createdOrgId = org.id;
      createdOrgSlug = org.slug;

      // Add memberId as VIEWER in this org for subsequent tests
      const viewerRoleRes = await pool.query(`SELECT id FROM roles WHERE code = 'VIEWER'`);
      if (viewerRoleRes.rows[0]) {
        await pool.query(
          `
          INSERT INTO organization_members (organization_id, user_id, role_id, status)
          VALUES ($1, $2, $3, 'ACTIVE')
          ON CONFLICT DO NOTHING;
        `,
          [createdOrgId, memberId, viewerRoleRes.rows[0].id]
        );
      }
    });

    test('1.2. POST /api/v1/organizations with explicitly conflicting slug handles gracefully (409)', async () => {
      const res = await requestApi('/api/v1/organizations', {
        method: 'POST',
        token: ownerToken,
        body: {
          name: 'Another Corp With Same Slug',
          slug: createdOrgSlug, // explicitly duplicate slug
        },
      });

      assert.strictEqual(res.status, 409, 'Duplicate explicit slug must return 409 Conflict');
    });

    test('1.3. POST /api/v1/organizations rejects invalid validation (<2 chars name)', async () => {
      const res = await requestApi('/api/v1/organizations', {
        method: 'POST',
        token: ownerToken,
        body: {
          name: 'A', // too short
        },
      });

      assert.strictEqual(res.status, 400, 'Invalid name length must return 400 Bad Request');
    });
  });

  // ==========================================
  // 2. [2.10] & [2.11] GET & PUT ORGANIZATION
  // ==========================================
  describe('2. Organization GET & PUT ([2.10] & [2.11])', () => {
    test('2.1. GET /api/v1/organizations/:id returns details for valid member', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        token: ownerToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.id, createdOrgId);
      assert.strictEqual(res.data?.data?.name, 'Acme SelfHeal Corp');
    });

    test('2.2. GET /api/v1/organizations/:id rejects outsider with 403 Forbidden', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        token: outsiderToken,
      });

      assert.strictEqual(res.status, 403, 'Outsider must be rejected with 403');
    });

    test('2.3. PUT /api/v1/organizations/:id allows SME_OWNER to update details', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        method: 'PUT',
        token: ownerToken,
        body: {
          name: 'Acme SelfHeal Enterprise',
          description: 'Updated description for enterprise tier',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.name, 'Acme SelfHeal Enterprise');
      assert.strictEqual(res.data?.data?.description, 'Updated description for enterprise tier');
    });

    test('2.4. PUT /api/v1/organizations/:id rejects non-owner member with 403 Forbidden', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        method: 'PUT',
        token: memberToken, // member is VIEWER, not SME_OWNER
        body: {
          name: 'Hacked Corp',
        },
      });

      assert.strictEqual(res.status, 403, 'Non-owner member must be rejected with 403');
    });
  });

  // ==========================================
  // 3. [2.12] PATCH KHÓA / VÔ HIỆU HÓA ORGANIZATION
  // ==========================================
  describe('3. Organization Status Lock/Unlock & Inactivation ([2.12])', () => {
    test('3.1. Non-owner member is FORBIDDEN (403) from changing organization status', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: memberToken,
        body: {
          status: 'SUSPENDED',
          reason: 'Attempted unauthorized lock',
        },
      });

      assert.strictEqual(res.status, 403, 'Regular member must not lock organization');
    });

    test('3.2. Non-existent organization returns 404 Not Found', async () => {
      const res = await requestApi('/api/v1/organizations/00000000-0000-0000-0000-000000000000/status', {
        method: 'PATCH',
        token: superAdminToken,
        body: {
          status: 'SUSPENDED',
        },
      });

      assert.strictEqual(res.status, 404, 'Non-existent organization must return 404');
    });

    test('3.3. Invalid status value returns 400 Bad Request', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: ownerToken,
        body: {
          status: 'INVALID_STATUS',
        },
      });

      assert.strictEqual(res.status, 400, 'Invalid status enum must return 400');
    });

    test('3.4. SME_OWNER can lock organization (ACTIVE -> SUSPENDED)', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: ownerToken,
        body: {
          status: 'SUSPENDED',
          reason: 'Maintenance and audit period',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.status, 'SUSPENDED');

      // Verify in PostgreSQL
      const dbCheck = await pool.query(`SELECT status FROM organizations WHERE id = $1`, [createdOrgId]);
      assert.strictEqual(dbCheck.rows[0].status, 'SUSPENDED');
    });

    test('3.5. Idempotent request with same status succeeds without error (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: ownerToken,
        body: {
          status: 'SUSPENDED',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.status, 'SUSPENDED');
    });

    test('3.6. When organization is SUSPENDED, operational actions (invite member) are FORBIDDEN (403)', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/members/invite`, {
        method: 'POST',
        token: ownerToken,
        body: {
          email: 'newbie@test.com',
          role_code: 'VIEWER',
        },
      });

      assert.strictEqual(
        res.status,
        403,
        'Operational actions on a SUSPENDED organization must be blocked with 403'
      );
      assert.match(res.data?.message, /tạm khóa|ngừng hoạt động/i);
    });

    test('3.7. SUPER_ADMIN can unlock organization (SUSPENDED -> ACTIVE)', async () => {
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: superAdminToken,
        body: {
          status: 'ACTIVE',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.status, 'ACTIVE');

      // Verify in PostgreSQL
      const dbCheck = await pool.query(`SELECT status FROM organizations WHERE id = $1`, [createdOrgId]);
      assert.strictEqual(dbCheck.rows[0].status, 'ACTIVE');
    });
  });

  // ==========================================
  // 4. [2.13] REDIS CACHE SUITE
  // ==========================================
  describe('4. Redis Cache Read-through & Invalidation ([2.13])', () => {
    test('4.1. GET /api/v1/organizations/:id populates cache on miss and serves from cache on hit', async () => {
      const cacheKey = RedisCacheService.organizationKey(createdOrgId);

      // Invalidate to guarantee cache miss
      await RedisCacheService.del(cacheKey);

      // 1st request -> Cache miss, queries Postgres and populates Redis
      const res1 = await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });
      assert.strictEqual(res1.status, 200);

      // Check if cache contains the organization
      const cached = await RedisCacheService.get<any>(cacheKey);
      if (RedisCacheService.isAvailable()) {
        assert.ok(cached, 'Cache must be populated after GET request');
        assert.strictEqual(cached.id, createdOrgId);
      }

      // 2nd request -> Cache hit, serves instantly
      const res2 = await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.data?.data?.id, createdOrgId);
    });

    test('4.2. PUT /api/v1/organizations/:id invalidates cached organization', async () => {
      const cacheKey = RedisCacheService.organizationKey(createdOrgId);

      // Ensure cache exists
      await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });

      // Update name
      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        method: 'PUT',
        token: ownerToken,
        body: {
          name: 'Acme SelfHeal Global LLC',
        },
      });
      assert.strictEqual(res.status, 200);

      // Next GET must return updated name from fresh data
      const resGet = await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });
      assert.strictEqual(resGet.data?.data?.name, 'Acme SelfHeal Global LLC');
    });

    test('4.3. PATCH /status invalidates cache so suspended status takes effect immediately', async () => {
      const cacheKey = RedisCacheService.organizationKey(createdOrgId);

      // Ensure cache exists
      await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });

      // Lock org
      await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: ownerToken,
        body: { status: 'SUSPENDED' },
      });

      // Next GET reflects SUSPENDED immediately
      const resGet = await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });
      assert.strictEqual(resGet.data?.data?.status, 'SUSPENDED');

      // Restore to ACTIVE
      await requestApi(`/api/v1/organizations/${createdOrgId}/status`, {
        method: 'PATCH',
        token: superAdminToken,
        body: { status: 'ACTIVE' },
      });
    });

    test('4.4. Redis unavailable fallback: system falls back gracefully to PostgreSQL with 0 downtime', async () => {
      // Force simulate Redis offline
      RedisCacheService.setSimulatedOffline(true);

      const res = await requestApi(`/api/v1/organizations/${createdOrgId}`, { token: ownerToken });
      assert.strictEqual(res.status, 200, 'GET must succeed via PostgreSQL fallback when Redis is offline');
      assert.strictEqual(res.data?.data?.id, createdOrgId);

      const updateRes = await requestApi(`/api/v1/organizations/${createdOrgId}`, {
        method: 'PUT',
        token: ownerToken,
        body: { description: 'Updated while Redis is offline' },
      });
      assert.strictEqual(updateRes.status, 200, 'PUT must succeed via PostgreSQL when Redis is offline');

      // Restore simulated offline
      RedisCacheService.setSimulatedOffline(false);
    });
  });
});
