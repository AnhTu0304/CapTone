-- ====================================================================
-- Migration: 05_add_profile_phone_and_job_title_to_users.sql
-- Mô tả: Bổ sung cột phone và job_title vào bảng users để lưu hồ sơ cá nhân
-- ====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
