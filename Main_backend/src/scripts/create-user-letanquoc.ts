import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { config } from '../config/env';

async function createSuperAdmin() {
  const email = 'letanquoc@gmail.com';
  const fullName = 'Lê Tấn Quốc (Super Admin)';
  const rawPassword = 'Tanquoc123@';

  console.log(`🚀 Bắt đầu tạo tài khoản Super Admin cho: ${email} (tài khoản: letanquoc)...`);

  const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: 'aiselfheal',
  });

  try {
    const client = await pool.connect();

    // 1. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    // 2. Tạo hoặc cập nhật User
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, status, email_verified_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           status = 'ACTIVE',
           email_verified_at = COALESCE(users.email_verified_at, NOW()),
           updated_at = NOW()
       RETURNING id, email, full_name, status, email_verified_at;`,
      [email.toLowerCase().trim(), passwordHash, fullName]
    );

    const user = userRes.rows[0];
    console.log(`  ✅ User ID: ${user.id}`);
    console.log(`  ✅ Họ và tên: ${user.full_name}`);
    console.log(`  ✅ Email: ${user.email}`);
    console.log(`  ✅ Trạng thái: ${user.status}`);

    // 3. Gán vai trò SUPER_ADMIN và ADMIN
    const rolesToAssign = ['SUPER_ADMIN', 'ADMIN'];
    for (const roleName of rolesToAssign) {
      const roleRes = await client.query('SELECT id FROM system_roles WHERE UPPER(name) = $1 LIMIT 1', [roleName]);
      if (roleRes.rows.length > 0) {
        const roleId = roleRes.rows[0].id;
        await client.query(
          `INSERT INTO user_system_roles (user_id, system_role_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, system_role_id) DO NOTHING;`,
          [user.id, roleId]
        );
        console.log(`  👑 Đã gán quyền hệ thống: [${roleName}]`);
      }
    }

    // 4. Gán quyền SME_OWNER vào tổ chức mẫu CapTone Secure Workspace (nếu có)
    const orgRes = await client.query("SELECT id FROM organizations WHERE name ILIKE '%CapTone Secure Workspace%' LIMIT 1");
    const smeRoleRes = await client.query("SELECT id FROM roles WHERE code = 'SME_OWNER' LIMIT 1");

    if (orgRes.rows.length > 0 && smeRoleRes.rows.length > 0) {
      const orgId = orgRes.rows[0].id;
      const smeRoleId = smeRoleRes.rows[0].id;

      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
         VALUES ($1, $2, $3, 'ACTIVE', NOW())
         ON CONFLICT (organization_id, user_id) DO UPDATE
         SET role_id = EXCLUDED.role_id, status = 'ACTIVE', updated_at = NOW();`,
        [orgId, user.id, smeRoleId]
      );
      console.log(`  🏢 Đã gán vai trò SME Owner vào tổ chức: CapTone Secure Workspace`);
    }

    client.release();
    await pool.end();

    console.log('\n================================================================');
    console.log('🎉 KHỞI TẠO TÀI KHOẢN SUPER ADMIN THÀNH CÔNG:');
    console.log(`👤 Tài khoản (Username): letanquoc`);
    console.log(`📧 Email đăng nhập:      ${email}`);
    console.log(`🔑 Mật khẩu (Password):  ${rawPassword}`);
    console.log(`👑 Vai trò hệ thống:     SUPER_ADMIN & ADMIN`);
    console.log(`🛡️ Trạng thái:           ACTIVE (Đã xác thực & kích hoạt)`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Lỗi khi khởi tạo tài khoản:', err);
    await pool.end();
    process.exit(1);
  }
}

createSuperAdmin().catch(console.error);

