import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { config } from '../config/env';
import { buildPgPoolConfig } from '../config/database';

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || 'phamthaisang1710@gmail.com').toLowerCase().trim();
  const fullName = process.env.SEED_ADMIN_NAME || process.env.INITIAL_ADMIN_NAME || 'Phạm Thái Sang';
  const envPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (config.isProduction && (!envPassword || envPassword.length < 12)) {
    throw new Error('FATAL SECURITY ERROR: SEED_ADMIN_PASSWORD (min 12 chars) must be provided in production');
  }
  const rawPassword = envPassword || 'AdminPassword123@';

  console.log(`🚀 Đang khởi tạo tài khoản Quản trị viên (Admin) cho: ${email}...`);

  const databases = (process.env.SEED_TARGET_DBS || 'aiselfhealing_test')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  for (const dbName of databases) {
    const pool = new Pool(buildPgPoolConfig('migrator', { database: dbName }));

    try {
      const client = await pool.connect();
      console.log(`\n📌 Đang thao tác trên database: [${dbName}]`);

      // 1. Tạo hoặc cập nhật User
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
      console.log(`  ✅ Trạng thái: ${user.status}`);
      console.log(`  ✅ Xác thực Email: ${user.email_verified_at}`);

      // 2. Gán quyền SUPER_ADMIN và ADMIN
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
          console.log(`  👑 Đã gán vai trò: [${roleName}]`);
        }
      }

      client.release();
      await pool.end();
    } catch (err) {
      console.warn(`  ⚠️ Cảnh báo trên database ${dbName}:`, (err as Error).message);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 TẠO TÀI KHOẢN ADMIN THÀNH CÔNG VỚI THÔNG TIN:');
  console.log(`📧 Email:      ${email}`);
  console.log(`🔑 Mật khẩu:   [REDACTED - set via SEED_ADMIN_PASSWORD]`);
  console.log(`👑 Vai trò:    SUPER_ADMIN & ADMIN`);
  console.log(`🛡️ Trạng thái: ACTIVE (Đã kích hoạt & xác thực email)`);
  console.log('================================================================\n');
}

seedAdmin().catch(console.error);
