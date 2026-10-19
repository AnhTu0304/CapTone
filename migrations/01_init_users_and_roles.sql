-- ====================================================================
-- Migration: 01_init_users_and_roles.sql
-- Mô tả: Khởi tạo các bảng Quản lý Người dùng, Xác thực & Phân quyền Hệ thống
-- Áp dụng cho: aiselfheal / captone_db
-- ====================================================================

-- Kích hoạt tiện ích mở rộng pgcrypto để sinh UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tạo kiểu ENUM user_status (nếu chưa có)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;
END $$;

-- 2. Bảng `users`: Thông tin người dùng
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    full_name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    status user_status NOT NULL DEFAULT 'PENDING',
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Chỉ mục tìm kiếm cho users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- 3. Bảng `email_verification_tokens`: Lưu trữ mã token xác thực OTP email
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ mục cho email_verification_tokens
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- 4. Bảng `system_roles`: Danh mục vai trò quản trị hệ thống
CREATE TABLE IF NOT EXISTS system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Khởi tạo sẵn 4 vai trò quản trị hệ thống chuẩn (xóa bỏ ràng buộc cũ nếu có)
ALTER TABLE system_roles DROP CONSTRAINT IF EXISTS chk_system_roles_name;

INSERT INTO system_roles (name, description) VALUES
    ('SUPER_ADMIN', 'Quản trị viên tối cao toàn hệ thống với mọi quyền hạn'),
    ('SYSTEM_ADMIN', 'Quản trị viên kỹ thuật, quản lý cụm, agent và chính sách'),
    ('ADMIN', 'Quản trị viên vận hành hệ thống và duyệt hành động phục hồi'),
    ('USER', 'Người dùng thông thường, người vận hành theo dõi hệ thống')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, updated_at = NOW();

-- 5. Bảng `user_system_roles`: Phân quyền vai trò hệ thống cho người dùng
CREATE TABLE IF NOT EXISTS user_system_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    system_role_id UUID NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, system_role_id)
);

-- Chỉ mục cho user_system_roles
CREATE INDEX IF NOT EXISTS idx_user_system_roles_user ON user_system_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_system_roles_role ON user_system_roles(system_role_id);
