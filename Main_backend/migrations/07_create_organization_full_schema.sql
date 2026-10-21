-- ====================================================================
-- Migration: 07_create_organization_full_schema.sql
-- Mô tả: Bổ sung các cột còn thiếu cho `organizations`, tạo bảng `roles`,
--       `organization_profiles`, `organization_members` và nạp seed data
-- ====================================================================

-- 1. Tạo các ENUM type nếu chưa tồn tại
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE member_status AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'REMOVED');
    END IF;
END $$;

-- 2. Cập nhật bảng `organizations` thêm các trường còn thiếu
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS status organization_status NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Tạo bảng `roles` (Vai trò trong tổ chức)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tạo bảng `organization_profiles` (Hồ sơ mở rộng của tổ chức)
CREATE TABLE IF NOT EXISTS organization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(30),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tạo bảng `organization_members` (Thành viên tổ chức)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    status member_status NOT NULL DEFAULT 'INVITED',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

-- 6. Nạp seed data vai trò tổ chức (roles)
INSERT INTO roles (code, name, description, scope) VALUES
('ADMIN', 'Platform Admin', 'Quản trị toàn bộ nền tảng', 'PLATFORM'),
('SME_OWNER', 'SME Owner', 'Quản lý tổ chức và kiểm soát self-healing', 'ORGANIZATION'),
('DEVOPS', 'DevOps', 'Quản lý hạ tầng, agent và vận hành kỹ thuật', 'ORGANIZATION'),
('VIEWER', 'Viewer', 'Chỉ xem dữ liệu được cấp quyền', 'ORGANIZATION')
ON CONFLICT (code) DO NOTHING;

-- 7. Seed hồ sơ và thành viên mặc định cho tổ chức đầu tiên
INSERT INTO organization_profiles (organization_id, description, email, timezone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Doanh nghiệp Bán lẻ SME Retail Enterprise', 'contact@smeretail.com', 'Asia/Ho_Chi_Minh')
ON CONFLICT (organization_id) DO NOTHING;

-- Gán tài khoản admin đầu tiên làm SME_OWNER của tổ chức mặc định nếu có
DO $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users LIMIT 1;
    SELECT id INTO v_role_id FROM roles WHERE code = 'SME_OWNER' LIMIT 1;
    
    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
        VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, v_role_id, 'ACTIVE', NOW())
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
END $$;
