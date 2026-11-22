-- Migration 30: Sprint C Phase 1 — Least-Privilege Database Roles, Helper Context Functions, & PostgreSQL FORCE RLS
-- NOTE: Requires execution by superuser / privileged migration role on initial role setup.
-- Intentionally EXCLUDED from tenant RLS (10 tables):
--   GLOBAL (4): system_roles, organization_roles, healing_action_types, ai_models
--   SYSTEM_MANAGED (1): system_broadcasts
--   AUTHENTICATION / GLOBAL USER IDENTITY (5): users, user_system_roles, user_two_factor, email_verification_tokens, password_reset_tokens

-- ============================================================================
-- 1. Least-Privilege Database Role Separation
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_migrator') THEN
    CREATE ROLE selfheal_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  ELSE
    ALTER ROLE selfheal_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_app') THEN
    CREATE ROLE selfheal_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  ELSE
    ALTER ROLE selfheal_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_readonly') THEN
    CREATE ROLE selfheal_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  ELSE
    ALTER ROLE selfheal_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION LOGIN;
  END IF;

  -- NOLOGIN internal definer role strictly for narrow read-only SECURITY DEFINER auth/worker lookups
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_sysdefiner') THEN
    CREATE ROLE selfheal_sysdefiner NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOREPLICATION NOLOGIN;
  ELSE
    ALTER ROLE selfheal_sysdefiner NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOREPLICATION NOLOGIN;
  END IF;
END
$$;

-- Transfer ownership of all public tables, views, and standalone sequences to selfheal_migrator
-- (owned serial/identity sequences transfer automatically with their owning table in PostgreSQL).
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
  LOOP
    IF rec.relkind IN ('v', 'm') THEN
      EXECUTE format('ALTER VIEW public.%I OWNER TO selfheal_migrator;', rec.relname);
    ELSE
      EXECUTE format('ALTER TABLE public.%I OWNER TO selfheal_migrator;', rec.relname);
    END IF;
  END LOOP;

  FOR rec IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype IN ('a', 'i')
      )
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO selfheal_migrator;', rec.relname);
  END LOOP;
END
$$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO selfheal_migrator;
GRANT USAGE ON SCHEMA public TO selfheal_app, selfheal_readonly, selfheal_sysdefiner;
GRANT SELECT ON public.agent_tokens, public.agents, public.environments, public.organizations, public.organization_invitations, public.organization_roles, public.organization_members, public.approvals, public.healing_actions, public.incidents TO selfheal_sysdefiner;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO selfheal_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.system_roles, public.organization_roles FROM selfheal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO selfheal_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO selfheal_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO selfheal_readonly;

ALTER DEFAULT PRIVILEGES FOR ROLE selfheal_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO selfheal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE selfheal_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO selfheal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE selfheal_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO selfheal_readonly;

-- ============================================================================
-- 2. Fail-Closed Transaction-Local Context Accessors
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_access_scope() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.access_scope', true), ''), 'NONE');
$$;

CREATE OR REPLACE FUNCTION public.app_current_org_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.current_org_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.current_org_id', true)::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.current_user_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.current_user_id', true)::uuid
    ELSE NULL
  END;
$$;

ALTER FUNCTION public.app_access_scope() OWNER TO selfheal_migrator;
ALTER FUNCTION public.app_current_org_id() OWNER TO selfheal_migrator;
ALTER FUNCTION public.app_current_user_id() OWNER TO selfheal_migrator;
GRANT EXECUTE ON FUNCTION public.app_access_scope() TO selfheal_app, selfheal_readonly;
GRANT EXECUTE ON FUNCTION public.app_current_org_id() TO selfheal_app, selfheal_readonly;
GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO selfheal_app, selfheal_readonly;

-- ============================================================================
-- 3. Narrow SECURITY DEFINER Functions for Pre-Tenant Auth & Worker Enumeration
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_authenticate_agent_token(p_token_hash text)
RETURNS TABLE (
  id uuid,
  name varchar,
  agent_uid varchar,
  cluster_id varchar,
  environment_id uuid,
  status varchar,
  token_id uuid,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.agent_uid,
    a.cluster_id,
    a.environment_id,
    a.status,
    t.id AS token_id,
    e.organization_id
  FROM public.agent_tokens t
  JOIN public.agents a ON a.id = t.agent_id
  JOIN public.environments e ON a.environment_id = e.id
  WHERE t.token_hash = p_token_hash
    AND (t.expires_at IS NULL OR t.expires_at > NOW())
    AND t.revoked_at IS NULL
    AND a.revoked_at IS NULL
    AND a.status != 'REVOKED'
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_list_active_organization_ids()
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT o.id
  FROM public.organizations o
  WHERE o.deleted_at IS NULL AND o.status = 'ACTIVE'
  ORDER BY o.created_at ASC;
$$;

DROP FUNCTION IF EXISTS public.fn_lookup_invitation_by_token_hash(text);
CREATE OR REPLACE FUNCTION public.fn_lookup_invitation_by_token_hash(p_token_hash text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email varchar,
  role_id uuid,
  invited_by uuid,
  token_hash text,
  status varchar,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  org_name varchar,
  org_status public.organization_status,
  org_deleted_at timestamptz,
  role_code varchar,
  role_name varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    i.id,
    i.organization_id,
    i.email,
    i.role_id,
    i.invited_by,
    i.token_hash,
    i.status,
    i.expires_at,
    i.accepted_at,
    i.accepted_by,
    i.created_at,
    i.updated_at,
    o.name AS org_name,
    o.status AS org_status,
    o.deleted_at AS org_deleted_at,
    r.code AS role_code,
    r.name AS role_name
  FROM public.organization_invitations i
  JOIN public.organizations o ON i.organization_id = o.id
  JOIN public.organization_roles r ON i.role_id = r.id
  WHERE i.token_hash = p_token_hash
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_lookup_approval_context(p_approval_id uuid)
RETURNS TABLE (
  approval_id uuid,
  healing_action_id uuid,
  organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    ap.id AS approval_id,
    ap.healing_action_id,
    COALESCE(env.organization_id, i.organization_id) AS organization_id
  FROM public.approvals ap
  JOIN public.healing_actions h ON h.id = ap.healing_action_id
  LEFT JOIN public.environments env ON env.id = h.environment_id
  LEFT JOIN public.incidents i ON i.id = h.incident_id
  WHERE ap.id = p_approval_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_user_has_org_membership(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_org_id
      AND om.status = 'ACTIVE'
  );
$$;

ALTER FUNCTION public.fn_authenticate_agent_token(text) OWNER TO selfheal_sysdefiner;
ALTER FUNCTION public.fn_list_active_organization_ids() OWNER TO selfheal_sysdefiner;
ALTER FUNCTION public.fn_lookup_invitation_by_token_hash(text) OWNER TO selfheal_sysdefiner;
ALTER FUNCTION public.fn_lookup_approval_context(uuid) OWNER TO selfheal_sysdefiner;
ALTER FUNCTION public.fn_user_has_org_membership(uuid, uuid) OWNER TO selfheal_sysdefiner;

REVOKE ALL ON FUNCTION public.fn_authenticate_agent_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_list_active_organization_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_lookup_invitation_by_token_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_lookup_approval_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_user_has_org_membership(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_authenticate_agent_token(text) TO selfheal_app;
GRANT EXECUTE ON FUNCTION public.fn_list_active_organization_ids() TO selfheal_app;
GRANT EXECUTE ON FUNCTION public.fn_lookup_invitation_by_token_hash(text) TO selfheal_app;
GRANT EXECUTE ON FUNCTION public.fn_lookup_approval_context(uuid) TO selfheal_app;
GRANT EXECUTE ON FUNCTION public.fn_user_has_org_membership(uuid, uuid) TO selfheal_app;

-- ============================================================================
-- 4. Enable + FORCE ROW LEVEL SECURITY on Tenant-Scoped & Audit Tables
-- ============================================================================

-- Helper DO block to idempotently reset Sprint C policies before creating fresh ones
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'sc\_%' ESCAPE '\'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- A. Standard Direct organization_id Tables (9 + 2 alert_* = 11 strict tables)
DO $$
DECLARE
  t text;
  direct_tables text[] := ARRAY[
    'environments',
    'healing_policies',
    'incidents',
    'agent_metrics',
    'node_metrics',
    'organization_alert_settings',
    'organization_profiles',
    'alert_rules',
    'alert_events'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);

    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I
        FOR ALL TO selfheal_app
        USING (
          public.app_access_scope() = 'TENANT'
          AND organization_id = public.app_current_org_id()
        )
        WITH CHECK (
          public.app_access_scope() = 'TENANT'
          AND organization_id = public.app_current_org_id()
        );
    $sql$, t);

    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I
        FOR SELECT TO selfheal_app, selfheal_readonly
        USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- B. organizations (root tenant)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_tenant_org_select_upd ON public.organizations
  FOR SELECT TO selfheal_app
  USING (
    public.app_access_scope() = 'TENANT'
    AND id = public.app_current_org_id()
  );

CREATE POLICY sc_tenant_org_update ON public.organizations
  FOR UPDATE TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND id = public.app_current_org_id())
  WITH CHECK (public.app_access_scope() = 'TENANT' AND id = public.app_current_org_id());

CREATE POLICY sc_auth_org_self_select ON public.organizations
  FOR SELECT TO selfheal_app
  USING (
    public.app_access_scope() = 'AUTH'
    AND (
      created_by = public.app_current_user_id()
      OR public.fn_user_has_org_membership(public.app_current_user_id(), id)
    )
  );

CREATE POLICY sc_auth_org_create ON public.organizations
  FOR INSERT TO selfheal_app
  WITH CHECK (
    public.app_access_scope() = 'AUTH'
    AND created_by = public.app_current_user_id()
  );

CREATE POLICY sc_platform_admin_all_orgs ON public.organizations
  FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'PLATFORM_ADMIN')
  WITH CHECK (public.app_access_scope() = 'PLATFORM_ADMIN');

CREATE POLICY sc_readonly_platform_orgs ON public.organizations
  FOR SELECT TO selfheal_readonly
  USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- C. organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_tenant_org_members ON public.organization_members
  FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id())
  WITH CHECK (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id());

CREATE POLICY sc_auth_org_members_self_select ON public.organization_members
  FOR SELECT TO selfheal_app
  USING (public.app_access_scope() = 'AUTH' AND user_id = public.app_current_user_id());

CREATE POLICY sc_auth_org_members_self_join ON public.organization_members
  FOR INSERT TO selfheal_app
  WITH CHECK (
    public.app_access_scope() = 'AUTH'
    AND user_id = public.app_current_user_id()
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = public.app_current_user_id())
      OR EXISTS (
        SELECT 1
        FROM public.organization_invitations inv
        JOIN public.users u ON LOWER(u.email) = LOWER(inv.email)
        WHERE u.id = public.app_current_user_id()
          AND inv.organization_id = organization_members.organization_id
          AND inv.status = 'PENDING'
      )
    )
  );

CREATE POLICY sc_platform_admin_org_members ON public.organization_members
  FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'PLATFORM_ADMIN')
  WITH CHECK (public.app_access_scope() = 'PLATFORM_ADMIN');

-- D. organization_invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_tenant_org_invitations ON public.organization_invitations
  FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id())
  WITH CHECK (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id());

CREATE POLICY sc_auth_self_invitations ON public.organization_invitations
  FOR ALL TO selfheal_app
  USING (
    public.app_access_scope() = 'AUTH'
    AND LOWER(email) = LOWER((SELECT u.email FROM public.users u WHERE u.id = public.app_current_user_id()))
  )
  WITH CHECK (
    public.app_access_scope() = 'AUTH'
    AND LOWER(email) = LOWER((SELECT u.email FROM public.users u WHERE u.id = public.app_current_user_id()))
  );

CREATE POLICY sc_platform_admin_org_invitations_select ON public.organization_invitations
  FOR SELECT TO selfheal_app, selfheal_readonly
  USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- E. notifications (Hybrid user + org per PO A2 approval)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_notifications_select ON public.notifications
  FOR SELECT TO selfheal_app
  USING (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id() AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'AUTH' AND user_id = public.app_current_user_id() AND (organization_id IS NULL OR public.fn_user_has_org_membership(public.app_current_user_id(), organization_id)))
    OR (public.app_access_scope() = 'PLATFORM_ADMIN')
  );

CREATE POLICY sc_notifications_update_del ON public.notifications
  FOR UPDATE TO selfheal_app
  USING (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id() AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'AUTH' AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'PLATFORM_ADMIN')
  )
  WITH CHECK (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id() AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'AUTH' AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'PLATFORM_ADMIN')
  );

CREATE POLICY sc_notifications_delete ON public.notifications
  FOR DELETE TO selfheal_app
  USING (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id() AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'AUTH' AND user_id = public.app_current_user_id())
    OR (public.app_access_scope() = 'PLATFORM_ADMIN')
  );

CREATE POLICY sc_notifications_insert ON public.notifications
  FOR INSERT TO selfheal_app
  WITH CHECK (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id())
    OR (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'))
  );

-- F. audit_logs (Mixed Tenant + Platform AUDIT table per PO A2 approval)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_audit_tenant_select ON public.audit_logs
  FOR SELECT TO selfheal_app
  USING (
    public.app_access_scope() = 'TENANT'
    AND organization_id IS NOT NULL
    AND organization_id = public.app_current_org_id()
  );

CREATE POLICY sc_audit_tenant_write ON public.audit_logs
  FOR INSERT TO selfheal_app
  WITH CHECK (
    (public.app_access_scope() = 'TENANT' AND organization_id = public.app_current_org_id())
    OR (public.app_access_scope() = 'AUTH' AND organization_id IS NULL AND (user_id IS NULL OR user_id = public.app_current_user_id()))
    OR (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'))
  );

CREATE POLICY sc_audit_tenant_update ON public.audit_logs
  FOR UPDATE TO selfheal_app
  USING (
    (public.app_access_scope() = 'TENANT' AND organization_id IS NOT NULL AND organization_id = public.app_current_org_id())
    OR (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'))
  )
  WITH CHECK (
    (public.app_access_scope() = 'TENANT' AND organization_id IS NOT NULL AND organization_id = public.app_current_org_id())
    OR (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'))
  );

CREATE POLICY sc_audit_platform_select_del ON public.audit_logs
  FOR SELECT TO selfheal_app, selfheal_readonly
  USING (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'));

CREATE POLICY sc_audit_platform_delete ON public.audit_logs
  FOR DELETE TO selfheal_app
  USING (public.app_access_scope() IN ('PLATFORM_ADMIN', 'SYSTEM'));

-- ============================================================================
-- 5. Indirect Tenant-Scoped Tables (23 Tables)
-- ============================================================================

-- Helper macro via DO blocks for clean, identical PLATFORM_ADMIN SELECT + strict TENANT parent-FK policies
-- 5.1 clusters -> environments
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_clusters ON public.clusters FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = clusters.environment_id AND e.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = clusters.environment_id AND e.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_clusters ON public.clusters FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.2 agents -> environments
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_agents ON public.agents FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = agents.environment_id AND e.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = agents.environment_id AND e.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_agents ON public.agents FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.3 agent_heartbeats -> agents -> environments
ALTER TABLE public.agent_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_heartbeats FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_agent_heartbeats ON public.agent_heartbeats FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.agents a JOIN public.environments e ON e.id = a.environment_id WHERE a.id = agent_heartbeats.agent_id AND e.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.agents a JOIN public.environments e ON e.id = a.environment_id WHERE a.id = agent_heartbeats.agent_id AND e.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_agent_heartbeats ON public.agent_heartbeats FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.4 agent_tokens -> agents -> environments (pre-auth verified via fn_authenticate_agent_token)
ALTER TABLE public.agent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_agent_tokens ON public.agent_tokens FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.agents a JOIN public.environments e ON e.id = a.environment_id WHERE a.id = agent_tokens.agent_id AND e.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.agents a JOIN public.environments e ON e.id = a.environment_id WHERE a.id = agent_tokens.agent_id AND e.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_agent_tokens ON public.agent_tokens FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.5 namespaces, nodes, services, pods -> clusters -> environments
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['namespaces', 'nodes', 'services', 'pods'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I FOR ALL TO selfheal_app
      USING (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (
          SELECT 1 FROM public.clusters c
          JOIN public.environments e ON e.id = c.environment_id
          WHERE c.id = %I.cluster_id AND e.organization_id = public.app_current_org_id()
        )
      )
      WITH CHECK (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (
          SELECT 1 FROM public.clusters c
          JOIN public.environments e ON e.id = c.environment_id
          WHERE c.id = %I.cluster_id AND e.organization_id = public.app_current_org_id()
        )
      );
    $sql$, t, t, t);
    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I FOR SELECT TO selfheal_app, selfheal_readonly
      USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- 5.6 workloads, logs, kubernetes_events (UUID cluster_id or namespace_id -> cluster -> environments; NEVER by cluster.name)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workloads', 'logs', 'kubernetes_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I FOR ALL TO selfheal_app
      USING (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (
          SELECT 1 FROM public.clusters c
          JOIN public.environments e ON e.id = c.environment_id
          WHERE e.organization_id = public.app_current_org_id()
            AND (
              c.id::text = %I.cluster_id
              OR c.id = (SELECT n.cluster_id FROM public.namespaces n WHERE n.id = %I.namespace_id)
            )
        )
      )
      WITH CHECK (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (
          SELECT 1 FROM public.clusters c
          JOIN public.environments e ON e.id = c.environment_id
          WHERE e.organization_id = public.app_current_org_id()
            AND (
              c.id::text = %I.cluster_id
              OR c.id = (SELECT n.cluster_id FROM public.namespaces n WHERE n.id = %I.namespace_id)
            )
        )
      );
    $sql$, t, t, t, t, t);
    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I FOR SELECT TO selfheal_app, selfheal_readonly
      USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- 5.7 deployments -> workloads -> clusters -> environments
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_deployments ON public.deployments FOR ALL TO selfheal_app
  USING (
    public.app_access_scope() = 'TENANT'
    AND EXISTS (
      SELECT 1 FROM public.workloads w
      JOIN public.clusters c ON (c.id::text = w.cluster_id OR c.id = (SELECT n.cluster_id FROM public.namespaces n WHERE n.id = w.namespace_id))
      JOIN public.environments e ON e.id = c.environment_id
      WHERE w.id = deployments.workload_id AND e.organization_id = public.app_current_org_id()
    )
  )
  WITH CHECK (
    public.app_access_scope() = 'TENANT'
    AND EXISTS (
      SELECT 1 FROM public.workloads w
      JOIN public.clusters c ON (c.id::text = w.cluster_id OR c.id = (SELECT n.cluster_id FROM public.namespaces n WHERE n.id = w.namespace_id))
      JOIN public.environments e ON e.id = c.environment_id
      WHERE w.id = deployments.workload_id AND e.organization_id = public.app_current_org_id()
    )
  );
CREATE POLICY sc_platform_admin_select_deployments ON public.deployments FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.8 ai_predictions & healing_actions -> environments
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_predictions', 'healing_actions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I FOR ALL TO selfheal_app
      USING (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = %I.environment_id AND e.organization_id = public.app_current_org_id())
      )
      WITH CHECK (
        public.app_access_scope() = 'TENANT'
        AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = %I.environment_id AND e.organization_id = public.app_current_org_id())
      );
    $sql$, t, t, t);
    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I FOR SELECT TO selfheal_app, selfheal_readonly
      USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- 5.9 prediction_inputs -> ai_predictions -> environments
ALTER TABLE public.prediction_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_inputs FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_prediction_inputs ON public.prediction_inputs FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.ai_predictions p JOIN public.environments e ON e.id = p.environment_id WHERE p.id = prediction_inputs.prediction_id AND e.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.ai_predictions p JOIN public.environments e ON e.id = p.environment_id WHERE p.id = prediction_inputs.prediction_id AND e.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_pred_inputs ON public.prediction_inputs FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.10 rca_analyses & ai_recommendations -> incidents
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rca_analyses', 'ai_recommendations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I FOR ALL TO selfheal_app
      USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = %I.incident_id AND i.organization_id = public.app_current_org_id()))
      WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = %I.incident_id AND i.organization_id = public.app_current_org_id()));
    $sql$, t, t, t);
    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I FOR SELECT TO selfheal_app, selfheal_readonly
      USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- 5.11 rca_evidences -> rca_analyses -> incidents
ALTER TABLE public.rca_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rca_evidences FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_rca_evidences ON public.rca_evidences FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.rca_analyses r JOIN public.incidents i ON i.id = r.incident_id WHERE r.id = rca_evidences.rca_analysis_id AND i.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.rca_analyses r JOIN public.incidents i ON i.id = r.incident_id WHERE r.id = rca_evidences.rca_analysis_id AND i.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_rca_evidences ON public.rca_evidences FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.12 approvals, execution_attempts, recovery_verifications -> healing_actions -> environments
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['approvals', 'execution_attempts', 'recovery_verifications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($sql$
      CREATE POLICY sc_tenant_isolation ON public.%I FOR ALL TO selfheal_app
      USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.healing_actions ha JOIN public.environments e ON e.id = ha.environment_id WHERE ha.id = %I.healing_action_id AND e.organization_id = public.app_current_org_id()))
      WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.healing_actions ha JOIN public.environments e ON e.id = ha.environment_id WHERE ha.id = %I.healing_action_id AND e.organization_id = public.app_current_org_id()));
    $sql$, t, t, t);
    EXECUTE format($sql$
      CREATE POLICY sc_platform_admin_select ON public.%I FOR SELECT TO selfheal_app, selfheal_readonly
      USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    $sql$, t);
  END LOOP;
END
$$;

-- 5.13 policy_actions -> healing_policies
ALTER TABLE public.policy_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_policy_actions ON public.policy_actions FOR ALL TO selfheal_app
  USING (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.healing_policies hp WHERE hp.id = policy_actions.policy_id AND hp.organization_id = public.app_current_org_id()))
  WITH CHECK (public.app_access_scope() = 'TENANT' AND EXISTS (SELECT 1 FROM public.healing_policies hp WHERE hp.id = policy_actions.policy_id AND hp.organization_id = public.app_current_org_id()));
CREATE POLICY sc_platform_admin_select_policy_actions ON public.policy_actions FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');

-- 5.14 alert_event_history -> direct organization_id OR alert_events
ALTER TABLE public.alert_event_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_event_history FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant_alert_event_history ON public.alert_event_history FOR ALL TO selfheal_app
  USING (
    public.app_access_scope() = 'TENANT'
    AND (
      organization_id = public.app_current_org_id()
      OR EXISTS (SELECT 1 FROM public.alert_events ae WHERE ae.id = alert_event_history.alert_event_id AND ae.organization_id = public.app_current_org_id())
    )
  )
  WITH CHECK (
    public.app_access_scope() = 'TENANT'
    AND (organization_id IS NULL OR organization_id = public.app_current_org_id())
    AND EXISTS (SELECT 1 FROM public.alert_events ae WHERE ae.id = alert_event_history.alert_event_id AND ae.organization_id = public.app_current_org_id())
  );
CREATE POLICY sc_platform_admin_select_alert_event_history ON public.alert_event_history FOR SELECT TO selfheal_app, selfheal_readonly USING (public.app_access_scope() = 'PLATFORM_ADMIN');
