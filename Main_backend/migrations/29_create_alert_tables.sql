-- Migration 29: Reconcile missing Alert Engine tables (alert_rules, alert_events, alert_event_history)
-- Idempotent DDL matching existing models & alert tests

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE CASCADE,
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
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON public.alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled ON public.alert_rules(organization_id, enabled);

CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  rule_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  namespace VARCHAR(255),
  severity VARCHAR(50) NOT NULL DEFAULT 'WARNING',
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  observed_value NUMERIC(14, 4),
  threshold_value NUMERIC(14, 4),
  unit VARCHAR(50),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint VARCHAR(255),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exact partial unique index required by AlertEventModel.createOrUpdateOpenEvent ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_events_open_dedup
  ON public.alert_events (
    organization_id,
    COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid),
    resource_type,
    resource_id,
    metric_type
  )
  WHERE status != 'RESOLVED';

CREATE INDEX IF NOT EXISTS idx_alert_events_org_status ON public.alert_events(organization_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_cluster ON public.alert_events(organization_id, cluster_id);

CREATE TABLE IF NOT EXISTS public.alert_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_event_id UUID NOT NULL REFERENCES public.alert_events(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  old_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_event_history_event ON public.alert_event_history(alert_event_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_alert_event_history_org ON public.alert_event_history(organization_id, created_at DESC);
