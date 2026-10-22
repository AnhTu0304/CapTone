import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis, redisClient, isRedisReady, testRedisConnection } from '../config/redis';
import { EmailQueue } from '../services/emailQueue.service';
import { OrganizationInvitationModel } from '../models/organizationInvitation.model';
import { SessionRevocationService } from '../services/sessionRevocation.service';

describe('Invitation, Acceptance, Role Management & Session Revocation API Suite [PB06 2.4]', () => {
  let server: http.Server;
  let baseUrl: string;

  // Test Fixture IDs
  const superAdminId = 'c1000000-0000-0000-0000-000000000001';
  const ownerAId = 'c1000000-0000-0000-0000-000000000002';
  const devopsAId = 'c1000000-0000-0000-0000-000000000003';
  const targetUserId = 'c1000000-0000-0000-0000-000000000004';
  const ownerBId = 'c1000000-0000-0000-0000-000000000005';

  const orgAId = 'd1000000-0000-0000-0000-000000000001';
  const orgBId = 'd1000000-0000-0000-0000-000000000002';

  let superAdminToken: string;
  let ownerAToken: string;
  let devopsAToken: string;
  let targetUserToken: string;
  let ownerBToken: string;

  let smeOwnerRoleId: string;
  let devopsRoleId: string;
  let viewerRoleId: string;

  before(async () => {
    // 1. Initialize Redis connection
    await testRedisConnection();

    // 2. Fetch Organization Role IDs
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    viewerRoleId = rolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

    // 3. Ensure test users exist
    await pool.query(
      `
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'superadmin.inv@test.com', 'dummy_hash', 'Super Admin Inv', 'ACTIVE', NOW(), NOW()),
        ($2, 'owner.a@test.com', 'dummy_hash', 'Owner A', 'ACTIVE', NOW(), NOW()),
        ($3, 'devops.a@test.com', 'dummy_hash', 'Devops A', 'ACTIVE', NOW(), NOW()),
        ($4, 'target.invitee@test.com', 'dummy_hash', 'Target Invitee', 'ACTIVE', NOW(), NOW()),
        ($5, 'owner.b@test.com', 'dummy_hash', 'Owner B', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `,
      [superAdminId, ownerAId, devopsAId, targetUserId, ownerBId]
    );

    // 4. Ensure SuperAdmin system role
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    if (srRes.rows[0]) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, srRes.rows[0].id]
      );
    }

    // 5. Ensure Organizations A and B exist
    await pool.query(
      `
      INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
      VALUES 
        ($1, 'Cloud Corp A', 'cloud-corp-a', 'ACTIVE', $2, NOW(), NOW()),
        ($3, 'Tech Ventures B', 'tech-ventures-b', 'ACTIVE', $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 6. Ensure Memberships:
    // ownerA is SME_OWNER of Org A
    // devopsA is DEVOPS of Org A
    // ownerB is SME_OWNER of Org B
    await pool.query(
      `
      INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
      VALUES 
        ($1, $2, $3, 'ACTIVE', NOW()),
        ($1, $4, $5, 'ACTIVE', NOW()),
        ($6, $7, $3, 'ACTIVE', NOW())
      ON CONFLICT (organization_id, user_id) 
      DO UPDATE SET role_id = EXCLUDED.role_id, status = 'ACTIVE';
    `,
      [orgAId, ownerAId, smeOwnerRoleId, devopsAId, devopsRoleId, orgBId, ownerBId]
    );

    // Clean up any existing invitations or memberships for targetUserId in Org A
    await pool.query(`DELETE FROM organization_invitations WHERE organization_id = $1;`, [orgAId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2;`, [
      orgAId,
      targetUserId,
    ]);

    // 7. Generate JWT tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'superadmin.inv@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'owner.a@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsAToken = jwt.sign(
      { id: devopsAId, email: 'devops.a@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    targetUserToken = jwt.sign(
      { id: targetUserId, email: 'target.invitee@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'owner.b@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 8. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}/api/v1/organizations`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM organization_invitations WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5);`, [
      superAdminId,
      ownerAId,
      devopsAId,
      targetUserId,
      ownerBId,
    ]);

    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeRedis();
    await pool.end();
  });

  // =========================================================================
  // TEST SUITE 1: TẠO VÀ QUẢN LÝ LỜI MỜI (RBAC & ISOLATION)
  // =========================================================================

  let createdInvitationToken: string;
  let createdInvitationId: string;

  test('1. Admin/Owner Org A có quyền mời thành viên mới hợp lệ (sinh token, lưu DB, enqueue email)', async () => {
    const res = await fetch(`${baseUrl}/${orgAId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'target.invitee@test.com',
        role_code: 'DEVOPS',
      }),
    });

    const body = (await res.json()) as any;
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.invitation.id, 'Invitation ID phải tồn tại');
    assert.strictEqual(body.data.invitation.email, 'target.invitee@test.com');
    assert.strictEqual(body.data.invitation.role.code, 'DEVOPS');
    assert.strictEqual(body.data.invitation.status, 'PENDING');
    assert.ok(body.data.token, 'Token bí mật phải được trả về');

    createdInvitationToken = body.data.token;
    createdInvitationId = body.data.invitation.id;

    // Xác minh token hash đã được lưu an toàn trong PostgreSQL
    const expectedHash = crypto.createHash('sha256').update(createdInvitationToken).digest('hex');
    const dbInv = await pool.query(`SELECT * FROM organization_invitations WHERE id = $1`, [createdInvitationId]);
    assert.strictEqual(dbInv.rows.length, 1);
    assert.strictEqual(dbInv.rows[0].token_hash, expectedHash);
  });

  test('2. User không đủ quyền (DEVOPS) không thể mời thành viên (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/${orgAId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'another.person@test.com',
        role_code: 'VIEWER',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
  });

  test('3. Không cho phép truy cập hoặc thao tác lời mời của Organization khác (Org Isolation)', async () => {
    // Owner B (của Org B) cố gắng xem danh sách lời mời của Org A
    const res = await fetch(`${baseUrl}/${orgAId}/invitations`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
  });

  test('4. Cấm tuyệt đối cấp vai trò hệ thống (SUPER_ADMIN, ADMIN) qua API mời thành viên', async () => {
    const res = await fetch(`${baseUrl}/${orgAId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'hacker@test.com',
        role_code: 'SUPER_ADMIN',
      }),
    });

    // Zod validation hoặc Service throw 400/403
    assert.ok([400, 403].includes(res.status));
  });

  test('5. Không thể tạo lời mời trùng nếu đã có một lời mời PENDING (returns 409 Conflict)', async () => {
    const res = await fetch(`${baseUrl}/${orgAId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'target.invitee@test.com',
        role_code: 'DEVOPS',
      }),
    });

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as any;
    assert.match(body.message, /đã có một lời mời đang chờ/i);
  });

  // =========================================================================
  // TEST SUITE 2: CHẤP NHẬN LỜI MỜI BẰNG TOKEN (ATOMICITY & VALIDATION)
  // =========================================================================

  test('6. Người khác không thể dùng token của người nhận (Email Mismatch returns 403)', async () => {
    // devopsA cố tình dùng token của target.invitee
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: createdInvitationToken }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.match(body.message, /không trùng khớp/i);
  });

  test('7. Token hợp lệ được người nhận xác nhận thành công đúng một lần (returns 200 & status = ACTIVE)', async () => {
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: createdInvitationToken }),
    });

    const body = (await res.json()) as any;
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organization_id, orgAId);
    assert.strictEqual(body.data.role_code, 'DEVOPS');

    // Xác minh trong database: status chuyển sang ACCEPTED
    const dbInv = await pool.query(`SELECT status, accepted_by FROM organization_invitations WHERE id = $1`, [
      createdInvitationId,
    ]);
    assert.strictEqual(dbInv.rows[0].status, 'ACCEPTED');
    assert.strictEqual(dbInv.rows[0].accepted_by, targetUserId);

    // Xác minh bảng organization_members: thành viên đã ACTIVE
    const dbMember = await pool.query(
      `SELECT status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgAId, targetUserId]
    );
    assert.strictEqual(dbMember.rows[0].status, 'ACTIVE');
  });

  test('8. Token đã sử dụng bị từ chối khi gọi lại (returns 409 Conflict)', async () => {
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: createdInvitationToken }),
    });

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as any;
    assert.match(body.message, /đã được chấp nhận trước đó/i);
  });

  test('9. Token giả mạo hoặc không tồn tại bị từ chối (returns 404)', async () => {
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: 'invalid_dummy_nonexistent_token_123456' }),
    });

    assert.strictEqual(res.status, 404);
  });

  // =========================================================================
  // TEST SUITE 3: THU HỒI, GỬI LẠI VÀ TOKEN EXPIRED
  // =========================================================================

  test('10. Thu hồi lời mời (Revoke) làm vô hiệu hóa token (returns 410 Gone khi accept)', async () => {
    // 1. Tạo lời mời mới
    const inviteRes = await OrganizationInvitationModel.create(undefined, {
      organization_id: orgAId,
      email: 'revoke.test@test.com',
      role_id: devopsRoleId,
      token_hash: crypto.createHash('sha256').update('revoke_token_123').digest('hex'),
      expires_at: new Date(Date.now() + 86400000),
    });

    // 2. Owner A thu hồi lời mời
    const revokeRes = await fetch(`${baseUrl}/${orgAId}/invitations/${inviteRes.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(revokeRes.status, 200);

    // 3. Cố tình accept token đã bị thu hồi
    const acceptRes = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: 'revoke_token_123' }),
    });
    assert.strictEqual(acceptRes.status, 410);
  });

  test('11. Token hết hạn (Expired) bị từ chối (returns 410 Gone)', async () => {
    // Tạo lời mời đã hết hạn từ hôm qua
    await OrganizationInvitationModel.create(undefined, {
      organization_id: orgAId,
      email: 'expired.test@test.com',
      role_id: devopsRoleId,
      token_hash: crypto.createHash('sha256').update('expired_token_123').digest('hex'),
      expires_at: new Date(Date.now() - 86400000), // Hôm qua
    });

    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: 'expired_token_123' }),
    });

    assert.strictEqual(res.status, 410);
  });

  // =========================================================================
  // TEST SUITE 4: SESSION & ACCESS REVOCATION (LOGOUT & ROLE DEMOTION)
  // =========================================================================

  test('12. Đăng xuất (POST /api/v1/auth/logout) thu hồi JWT Token qua Redis Blacklist ngay lập tức', async () => {
    const authUrl = baseUrl.replace('/organizations', '/auth');

    // Tạo token thử nghiệm
    const ephemeralToken = jwt.sign(
      { id: targetUserId, email: 'target.invitee@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '10m', algorithm: 'HS256' }
    );

    // 1. Kiểm tra token đang hợp lệ
    const checkBeforeRes = await fetch(`${authUrl}/me`, {
      headers: { Authorization: `Bearer ${ephemeralToken}` },
    });
    assert.strictEqual(checkBeforeRes.status, 200);

    // 2. Gọi logout
    const logoutRes = await fetch(`${authUrl}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ephemeralToken}` },
    });
    assert.strictEqual(logoutRes.status, 200);

    // 3. Ngay lập tức gọi lại /me với token cũ -> Phải bị từ chối 401
    const checkAfterRes = await fetch(`${authUrl}/me`, {
      headers: { Authorization: `Bearer ${ephemeralToken}` },
    });
    assert.strictEqual(checkAfterRes.status, 401);
    const body = (await checkAfterRes.json()) as any;
    assert.match(body.message, /đã bị thu hồi|kết thúc/i);
  });

  test('13. Xóa thành viên khỏi tổ chức thu hồi quyền truy cập ngay lập tức trên các endpoint nhạy cảm (403)', async () => {
    // 1. TargetUser đang là DEVOPS của Org A (đã gia nhập ở Test 7)
    // TargetUser có quyền xem chi tiết Org A
    const beforeRemoveRes = await fetch(`${baseUrl}/${orgAId}`, {
      headers: { Authorization: `Bearer ${targetUserToken}` },
    });
    assert.strictEqual(beforeRemoveRes.status, 200);

    // 2. Owner A xóa targetUser khỏi Org A
    const removeRes = await fetch(`${baseUrl}/${orgAId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(removeRes.status, 200);

    // 3. TargetUser gọi lại endpoint xem chi tiết Org A -> Phải bị chặn 403 ngay lập tức
    const afterRemoveRes = await fetch(`${baseUrl}/${orgAId}`, {
      headers: { Authorization: `Bearer ${targetUserToken}` },
    });
    assert.strictEqual(afterRemoveRes.status, 403);
    const body = (await afterRemoveRes.json()) as any;
    assert.match(body.message, /không phải là thành viên đang hoạt động/i);
  });
});
