-- Migration: 08_enhance_audit_logs.sql
-- Description: Bổ sung các trường reason_code, request_id, user_agent và indexes phục vụ truy vấn bảo mật & tenant audit logs

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason_code VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Bổ sung indexes tối ưu truy vấn theo Actor, Action, Status, Time, Organization
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
