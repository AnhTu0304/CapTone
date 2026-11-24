-- ============================================================================
-- Migration: 32_sprint_d_tenant_integrity_constraints.sql
-- Scope (SD-01-05 / AUD-A01): Backfill missing organization_id values from parent
-- FKs and enforce NOT NULL on incidents.organization_id & node_metrics.organization_id.
-- Keeps audit_logs.organization_id (platform events), notifications.organization_id
-- (global/user broadcasts), and healing_policies.environment_id (org-wide policy)
-- nullable by design; preserves alert_event_history & agent_metrics compatibility
-- with legacy snapshot callers while backfilling any missing org IDs.
-- ============================================================================

UPDATE incidents i
SET organization_id = e.organization_id
FROM environments e
WHERE i.organization_id IS NULL
  AND i.environment_id = e.id;

UPDATE agent_metrics am
SET organization_id = e.organization_id
FROM environments e
WHERE am.organization_id IS NULL
  AND am.environment_id = e.id
  AND e.organization_id IS NOT NULL;

UPDATE agent_metrics am
SET organization_id = e.organization_id
FROM agents a
JOIN environments e ON e.id = a.environment_id
WHERE am.organization_id IS NULL
  AND am.agent_id = a.id
  AND e.organization_id IS NOT NULL;

UPDATE node_metrics nm
SET organization_id = e.organization_id
FROM environments e
WHERE nm.organization_id IS NULL
  AND nm.environment_id = e.id;

UPDATE alert_event_history aeh
SET organization_id = ae.organization_id
FROM alert_events ae
WHERE aeh.organization_id IS NULL
  AND aeh.alert_event_id = ae.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM incidents WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on incidents.organization_id: orphan NULL rows exist';
  END IF;
  ALTER TABLE incidents ALTER COLUMN organization_id SET NOT NULL;

  IF EXISTS (SELECT 1 FROM node_metrics WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on node_metrics.organization_id: orphan NULL rows exist';
  END IF;
  ALTER TABLE node_metrics ALTER COLUMN organization_id SET NOT NULL;
END $$;
