-- ====================================================================
-- Migration: 21_rename_roles_to_organization_roles.sql
-- Mô tả: Chuẩn hóa tên bảng `roles` thành `organization_roles` để đối xứng
--        với `system_roles`, phản ánh đúng vai trò cấp tổ chức/doanh nghiệp.
--        Gỡ bỏ 2 VIEW tương thích cũ `roles` và `roles_organizations` (nếu còn).
-- ====================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE roles RENAME TO organization_roles;
        
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'roles_pkey') THEN
            ALTER INDEX roles_pkey RENAME TO organization_roles_pkey;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'roles_code_key') THEN
            ALTER INDEX roles_code_key RENAME TO organization_roles_code_key;
        END IF;
    END IF;
END $$;

DROP VIEW IF EXISTS roles;
DROP VIEW IF EXISTS roles_organizations;
