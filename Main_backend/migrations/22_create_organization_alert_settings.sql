-- ====================================================================
-- Migration: 22_create_organization_alert_settings.sql
-- Mô tả: Tạo bảng organization_alert_settings lưu cấu hình cảnh báo
--        khẩn cấp (email bổ sung, cooldown chống spam, kênh tích hợp)
--        cho từng tổ chức và tối ưu chỉ mục cho bảng notifications.
-- ====================================================================

CREATE TABLE IF NOT EXISTS organization_alert_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    critical_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_no_action BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_healing_failed BOOLEAN NOT NULL DEFAULT TRUE,
    extra_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
    cooldown_minutes INTEGER NOT NULL DEFAULT 15 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
    slack_webhook_url TEXT,
    slack_channel VARCHAR(100),
    pagerduty_key TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_incident
    ON notifications(incident_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);
