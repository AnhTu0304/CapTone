-- ====================================================================
-- Migration / Seed Script: 06_seed_admin_and_superadmin_users.sql
-- Mô tả: Khởi tạo 2 tài khoản quản trị viên với vai trò SUPER_ADMIN và ADMIN
-- Cơ sở dữ liệu: PostgreSQL (aiselfheal / captone_db)
-- ====================================================================

-- 1. Kích hoạt extension pgcrypto để sinh mã băm mật khẩu bcrypt tự động
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Đảm bảo 2 vai trò SUPER_ADMIN và ADMIN đã tồn tại trong danh mục system_roles
INSERT INTO system_roles (name, description) VALUES
    ('SUPER_ADMIN', 'Quản trị viên tối cao toàn hệ thống với mọi quyền hạn'),
    ('ADMIN', 'Quản trị viên vận hành hệ thống và duyệt hành động phục hồi')
ON CONFLICT (name) DO NOTHING;

-- 3. Khởi tạo tài khoản SUPER_ADMIN: superadmin@selfheal.com
-- Mật khẩu đăng nhập mặc định: AdminPassword123@
INSERT INTO users (
    email,
    password_hash,
    full_name,
    status,
    email_verified_at,
    created_at,
    updated_at
)
VALUES (
    'superadmin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Tối Cao (Super Admin)',
    'ACTIVE',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = crypt('AdminPassword123@', gen_salt('bf', 10)),
    full_name = EXCLUDED.full_name,
    status = 'ACTIVE',
    email_verified_at = COALESCE(users.email_verified_at, NOW()),
    updated_at = NOW();

-- Gán vai trò SUPER_ADMIN trong bảng user_system_roles
INSERT INTO user_system_roles (user_id, system_role_id)
SELECT u.id, sr.id 
FROM users u, system_roles sr
WHERE u.email = 'superadmin@selfheal.com' AND sr.name = 'SUPER_ADMIN'
ON CONFLICT (user_id, system_role_id) DO NOTHING;

-- 4. Khởi tạo tài khoản ADMIN: admin@selfheal.com
-- Mật khẩu đăng nhập mặc định: AdminPassword123@
INSERT INTO users (
    email,
    password_hash,
    full_name,
    status,
    email_verified_at,
    created_at,
    updated_at
)
VALUES (
    'admin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Vận Hành (Admin)',
    'ACTIVE',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = crypt('AdminPassword123@', gen_salt('bf', 10)),
    full_name = EXCLUDED.full_name,
    status = 'ACTIVE',
    email_verified_at = COALESCE(users.email_verified_at, NOW()),
    updated_at = NOW();

-- Gán vai trò ADMIN trong bảng user_system_roles
INSERT INTO user_system_roles (user_id, system_role_id)
SELECT u.id, sr.id 
FROM users u, system_roles sr
WHERE u.email = 'admin@selfheal.com' AND sr.name = 'ADMIN'
ON CONFLICT (user_id, system_role_id) DO NOTHING;

-- 5. Truy vấn kiểm tra lại kết quả gán vai trò
SELECT 
    u.id AS user_id,
    u.email,
    u.full_name,
    u.status,
    u.email_verified_at,
    sr.name AS system_role,
    usr.assigned_at
FROM users u
JOIN user_system_roles usr ON u.id = usr.user_id
JOIN system_roles sr ON usr.system_role_id = sr.id
WHERE u.email IN ('superadmin@selfheal.com', 'admin@selfheal.com')
ORDER BY sr.name DESC;
