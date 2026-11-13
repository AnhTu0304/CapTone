-- Migration 16: Create alert_events table and extend alert_rules metric types [S5][PBI21 Task 3.2]

-- 1. Extend alert_rules chk_alert_rule_metric_type constraint to support K8s and APM metric types
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS chk_alert_rule_metric_type;
ALTER TABLE alert_rules ADD CONSTRAINT chk_alert_rule_metric_type CHECK (
    metric_type IN (
        'CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT',
        'HTTP_5XX_RATE', 'ERROR_RATE', 'LATENCY', 'REQUEST_RATE',
        'POD_CRASH_LOOP', 'POD_FAILED', 'CONTAINER_OOM', 'NODE_NOT_READY', 'DEPLOYMENT_UNAVAILABLE'
    )
);

-- 2. Create alert_events table
CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    rule_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'WARNING',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    observed_value NUMERIC(14, 2),
    threshold_value NUMERIC(14, 2),
    unit VARCHAR(50),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alert_event_category CHECK (
        category IN ('RESOURCE', 'KUBERNETES', 'APM')
    ),
    CONSTRAINT chk_alert_event_severity CHECK (
        severity IN ('INFO', 'WARNING', 'CRITICAL')
    ),
    CONSTRAINT chk_alert_event_status CHECK (
        status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')
    )
);

-- 3. Indexes for fast query & filtering
CREATE INDEX IF NOT EXISTS idx_alert_events_org ON alert_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_cluster ON alert_events(cluster_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule ON alert_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);
CREATE INDEX IF NOT EXISTS idx_alert_events_category ON alert_events(category);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON alert_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_detected_at ON alert_events(first_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_last_seen ON alert_events(last_seen_at DESC);

-- 4. Deduplication Partial Unique Index (Only 1 open alert event per org, cluster, rule, resource, and metric)
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_alert_event ON alert_events (
    organization_id,
    COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid),
    resource_type,
    resource_id,
    metric_type
) WHERE status != 'RESOLVED';
