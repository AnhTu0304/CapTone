-- Migration 15: Create alert_rules table for threshold and alert configuration [S5][PBI21 Task 3.1]

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    operator VARCHAR(50) NOT NULL,
    threshold_value NUMERIC(14, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'WARNING',
    evaluation_window VARCHAR(50) NOT NULL DEFAULT '5m',
    duration INTEGER NOT NULL DEFAULT 60,
    cooldown_seconds INTEGER NOT NULL DEFAULT 300,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alert_rule_metric_type CHECK (
        metric_type IN ('CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT')
    ),
    CONSTRAINT chk_alert_rule_operator CHECK (
        operator IN ('GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'EQUAL', 'NOT_EQUAL')
    ),
    CONSTRAINT chk_alert_rule_severity CHECK (
        severity IN ('INFO', 'WARNING', 'CRITICAL')
    ),
    CONSTRAINT chk_alert_rule_duration CHECK (duration >= 0),
    CONSTRAINT chk_alert_rule_cooldown CHECK (cooldown_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_cluster ON alert_rules(cluster_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert_rules(severity);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_eval ON alert_rules(organization_id, enabled, metric_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_rules_org_name ON alert_rules(organization_id, LOWER(name));
