-- ==============================================================================
-- Migration: 19_alert_assignment_and_audit_trail.sql
-- Description: Bổ sung Assignment, Resolution Note, Concurrency Version cho alert_events
--              và mở rộng alert_event_history thành Audit Trail đầy đủ [S5][PBI22 Task 4.3]
-- ==============================================================================

-- 1. Bổ sung các cột phân công (assignment), ghi chú giải quyết và version vào alert_events
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 2. Mở rộng alert_event_history để hỗ trợ đầy đủ Audit Trail (Phạm vi Tenant, Old Value, New Value & Action Check)
ALTER TABLE alert_event_history ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE alert_event_history ADD COLUMN IF NOT EXISTS old_value JSONB DEFAULT '{}'::jsonb;
ALTER TABLE alert_event_history ADD COLUMN IF NOT EXISTS new_value JSONB DEFAULT '{}'::jsonb;

ALTER TABLE alert_event_history DROP CONSTRAINT IF EXISTS chk_alert_event_history_action;
ALTER TABLE alert_event_history ADD CONSTRAINT chk_alert_event_history_action CHECK (
    action IN (
        'TRIGGERED',
        'ALERT_CREATED',
        'UPDATED',
        'ESCALATED',
        'ACKNOWLEDGED',
        'ASSIGNED',
        'REASSIGNED',
        'UNASSIGNED',
        'RESOLVED',
        'AUTO_RESOLVED',
        'REOPENED'
    )
);

-- 3. Backfill organization_id cho các bản ghi lịch sử hiện có từ alert_events
UPDATE alert_event_history aeh
SET organization_id = ae.organization_id
FROM alert_events ae
WHERE aeh.alert_event_id = ae.id AND aeh.organization_id IS NULL;

-- 4. Bổ sung các chỉ mục phục vụ truy vấn Audit Trail và lọc theo người phụ trách
CREATE INDEX IF NOT EXISTS idx_alert_events_assigned_to 
    ON alert_events(organization_id, assigned_to) 
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_events_assigned_at 
    ON alert_events(organization_id, assigned_at DESC) 
    WHERE assigned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_history_org_created 
    ON alert_event_history(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_action 
    ON alert_event_history(action);

CREATE INDEX IF NOT EXISTS idx_alert_history_actor 
    ON alert_event_history(actor_id) 
    WHERE actor_id IS NOT NULL;
