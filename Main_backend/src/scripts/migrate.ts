import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function runMigration() {
  const possibleDirs = [
    path.resolve(__dirname, '../../migrations'),
    path.resolve(__dirname, '../../../migrations'),
  ];
  const migrationsDir = possibleDirs.find((d) => fs.existsSync(d) && fs.readdirSync(d).some((f) => f.endsWith('.sql'))) || possibleDirs[0];

  console.log('🔄 Đang đọc thư mục migration tại:', migrationsDir);

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Không tìm thấy thư mục migration:', migrationsDir);
    process.exit(1);
  }

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.log('⚠️ Không tìm thấy file migration (.sql) nào trong thư mục.');
    process.exit(0);
  }

  try {
    const client = await pool.connect();
    console.log('✅ Đã kết nối cơ sở dữ liệu PostgreSQL.');

    for (const file of sqlFiles) {
      console.log(`🚀 Đang thực thi migration: ${file}...`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sqlContent);
      console.log(`✅ Hoàn tất migration: ${file}`);
    }

    console.log('🎉 Toàn bộ migration cơ sở dữ liệu đã hoàn tất thành công!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi thực thi migration:', (error as Error).message);
    process.exit(1);
  }
}

runMigration();
