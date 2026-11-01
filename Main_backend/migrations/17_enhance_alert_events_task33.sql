-- Migration 17: Enhance alert_events with occurrence_count, fingerprint, and summary query indexes [S5][PBI21 Task 3.3]

ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);

-- Compute fingerprint for existing records if null
UPDATE alert_events 
SET fingerprint = md5(
    organization_id::text || ':' || 
    COALESCE(cluster_id::text, '00000000-0000-0000-0000-000000000000') || ':' || 
    COALESCE(rule_id::text, '00000000-0000-0000-0000-000000000000') || ':' || 
    resource_type || ':' || 
    resource_id || ':' || 
    metric_type
)
WHERE fingerprint IS NULL;

-- Indexes for fast query, deduplication lookup, and summary aggregation
CREATE INDEX IF NOT EXISTS idx_alert_events_fingerprint ON alert_events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_status_sev ON alert_events(organization_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_cluster_status ON alert_events(cluster_id, status);
