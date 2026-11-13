-- Migration 23: Enhance incidents table with service target_name & deduplication recurrence counters
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS target_name VARCHAR(255);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS last_occurred_at TIMESTAMPTZ DEFAULT NOW();

UPDATE incidents i
SET target_name = COALESCE(
  i.target_name,
  (SELECT w.name FROM workloads w WHERE w.id::text = i.target_id LIMIT 1),
  NULLIF(TRIM(substring(i.title FROM ' on ([a-zA-Z0-9_.-]+)$')), ''),
  NULLIF(TRIM(substring(i.title FROM ' trên dịch vụ ([a-zA-Z0-9_.-]+)$')), ''),
  NULLIF(TRIM(substring(i.title FROM ' trên ([a-zA-Z0-9_.-]+)$')), '')
)
WHERE i.target_name IS NULL;

UPDATE incidents
SET last_occurred_at = COALESCE(last_occurred_at, detected_at, created_at, NOW())
WHERE last_occurred_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_dedup_lookup
  ON incidents (environment_id, incident_type, status, target_name, last_occurred_at DESC);
