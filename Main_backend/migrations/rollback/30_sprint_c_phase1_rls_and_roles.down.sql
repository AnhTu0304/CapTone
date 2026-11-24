-- Rollback Migration 30: Disable & drop Sprint C Phase 1 RLS policies and SECURITY DEFINER helpers
-- Preserves existing data without loss; run as postgres / privileged DBA role.

DO $$
DECLARE
  pol RECORD;
  rls_tables text[] := ARRAY[
    'organizations', 'environments', 'healing_policies', 'incidents', 'agent_metrics', 'node_metrics',
    'organization_alert_settings', 'organization_invitations', 'organization_members', 'organization_profiles',
    'notifications', 'alert_rules', 'alert_events', 'audit_logs',
    'clusters', 'agents', 'agent_heartbeats', 'agent_tokens', 'namespaces', 'nodes', 'services',
    'workloads', 'deployments', 'pods', 'logs', 'kubernetes_events', 'ai_predictions', 'prediction_inputs',
    'rca_analyses', 'rca_evidences', 'ai_recommendations', 'healing_actions', 'approvals',
    'execution_attempts', 'recovery_verifications', 'policy_actions', 'alert_event_history'
  ];
  t text;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'sc\_%' ESCAPE '\'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;

  FOREACH t IN ARRAY rls_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY;', t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.fn_user_has_org_membership(uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_lookup_approval_context(uuid);
DROP FUNCTION IF EXISTS public.fn_lookup_invitation_by_token_hash(text);
DROP FUNCTION IF EXISTS public.fn_list_active_organization_ids();
DROP FUNCTION IF EXISTS public.fn_authenticate_agent_token(text);
DROP FUNCTION IF EXISTS public.app_current_user_id();
DROP FUNCTION IF EXISTS public.app_current_org_id();
DROP FUNCTION IF EXISTS public.app_access_scope();
