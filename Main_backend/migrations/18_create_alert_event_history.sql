-- Migration 18: Create alert_event_history table, enhance alert_events with namespace & resolved_by, and add query indexes [S5][PBI22 Task 4.1]

-- 1. Enhance alert_events table with resolved_by and direct namespace column
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS namespace VARCHAR(255);

-- 2. Backfill namespace from details JSONB if present
UPDATE alert_events
SET namespace = details->>'namespace'
WHERE namespace IS NULL AND details->>'namespace' IS NOT NULL;

-- 3. Create alert_event_history table to track complete lifecycle timeline of each alert event
CREATE TABLE IF NOT EXISTS alert_event_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_event_id UUID NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    note TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alert_event_history_action CHECK (
        action IN ('TRIGGERED', 'UPDATED', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED', 'AUTO_RESOLVED', 'REOPENED')
    ),
    CONSTRAINT chk_alert_event_history_actor_type CHECK (
        actor_type IN ('SYSTEM', 'USER', 'AGENT')
    )
);

-- 4. Indexes for fast history query & timeline sorting
CREATE INDEX IF NOT EXISTS idx_alert_events_namespace ON alert_events(namespace);
CREATE INDEX IF NOT EXISTS idx_alert_events_resolved_by ON alert_events(resolved_by);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_created ON alert_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_last_seen ON alert_events(organization_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_event_history_event_id ON alert_event_history(alert_event_id);
CREATE INDEX IF NOT EXISTS idx_alert_event_history_created_at ON alert_event_history(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_alert_event_history_action ON alert_event_history(action);
CREATE INDEX IF NOT EXISTS idx_alert_event_history_actor ON alert_event_history(actor_id);

-- 5. Backfill initial history for existing alert events so each has at least one timeline entry
INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_type, note, created_at)
SELECT 
    ae.id,
    NULL,
    'ACTIVE',
    'TRIGGERED',
    'SYSTEM',
    'Khởi phát cảnh báo: ' || ae.message,
    ae.first_detected_at
FROM alert_events ae
WHERE NOT EXISTS (
    SELECT 1 FROM alert_event_history aeh WHERE aeh.alert_event_id = ae.id
);

-- Backfill ACKNOWLEDGED history for events that were acknowledged
INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_id, actor_type, note, created_at)
SELECT 
    ae.id,
    'ACTIVE',
    'ACKNOWLEDGED',
    'ACKNOWLEDGED',
    ae.acknowledged_by,
    CASE WHEN ae.acknowledged_by IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
    COALESCE(ae.details->>'acknowledge_note', 'Tiếp nhận xử lý cảnh báo'),
    COALESCE(ae.acknowledged_at, ae.updated_at)
FROM alert_events ae
WHERE ae.acknowledged_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM alert_event_history aeh WHERE aeh.alert_event_id = ae.id AND aeh.action = 'ACKNOWLEDGED'
);

-- Backfill RESOLVED history for events that were resolved
INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_id, actor_type, note, created_at)
SELECT 
    ae.id,
    CASE WHEN ae.acknowledged_at IS NOT NULL THEN 'ACKNOWLEDGED' ELSE 'ACTIVE' END,
    'RESOLVED',
    CASE WHEN ae.details->>'resolved_by' = 'RULE_ENGINE_AUTO' THEN 'AUTO_RESOLVED' ELSE 'RESOLVED' END,
    ae.resolved_by,
    CASE WHEN ae.resolved_by IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
    COALESCE(ae.details->>'resolution_note', 'Sự cố đã được giải quyết'),
    COALESCE(ae.resolved_at, ae.updated_at)
FROM alert_events ae
WHERE ae.resolved_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM alert_event_history aeh WHERE aeh.alert_event_id = ae.id AND aeh.action IN ('RESOLVED', 'AUTO_RESOLVED')
);
