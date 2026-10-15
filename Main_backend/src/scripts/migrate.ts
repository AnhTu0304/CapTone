import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function runMigration() {
  const sqlFilePath = path.resolve(__dirname, '../../../migrations/01_init_users_and_roles.sql');
  console.log('🔄 Đang đọc file migration tại:', sqlFilePath);

  if (!fs.existsSync(sqlFilePath)) {
    console.error('❌ Không tìm thấy file migration:', sqlFilePath);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  try {
    const client = await pool.connect();
    console.log('✅ Đã kết nối cơ sở dữ liệu PostgreSQL.');
    console.log('🚀 Đang thực thi migration bảng Users, Roles và Tokens...');
    await client.query(sqlContent);
    console.log('🎉 Migration hoàn tất thành công!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi thực thi migration:', (error as Error).message);
    process.exit(1);
  }
}

runMigration();
