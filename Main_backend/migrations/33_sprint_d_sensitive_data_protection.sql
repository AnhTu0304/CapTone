-- ============================================================================
-- Migration: 33_sprint_d_sensitive_data_protection.sql
-- Scope (SD-03):
--   1. Create approval_email_tokens for hashed multi-approver HITL email tokens.
--   2. Enable + FORCE ROW LEVEL SECURITY on approval_email_tokens.
--   3. Wipe any legacy plaintext JWTs in approvals.approval_token.
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  healing_action_id UUID NOT NULL REFERENCES healing_actions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti VARCHAR(128) NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_email_tokens_approval
  ON approval_email_tokens(approval_id);

CREATE INDEX IF NOT EXISTS idx_approval_email_tokens_hash
  ON approval_email_tokens(token_hash);

-- Purge any legacy plaintext JWT values in approvals.approval_token
UPDATE approvals
SET approval_token = NULL
WHERE approval_token IS NOT NULL;

-- Ownership & least-privilege grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_migrator') THEN
    ALTER TABLE public.approval_email_tokens OWNER TO selfheal_migrator;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.approval_email_tokens TO selfheal_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_readonly') THEN
    GRANT SELECT ON TABLE public.approval_email_tokens TO selfheal_readonly;
  END IF;
END $$;

ALTER TABLE public.approval_email_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_email_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sc_tenant_isolation ON public.approval_email_tokens;
DROP POLICY IF EXISTS sc_platform_admin_select ON public.approval_email_tokens;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_app')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_access_scope') THEN
    CREATE POLICY sc_tenant_isolation ON public.approval_email_tokens
      FOR ALL TO selfheal_app
      USING (
        public.app_access_scope() = 'TENANT'
        AND organization_id = public.app_current_org_id()
      )
      WITH CHECK (
        public.app_access_scope() = 'TENANT'
        AND organization_id = public.app_current_org_id()
      );

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_readonly') THEN
      CREATE POLICY sc_platform_admin_select ON public.approval_email_tokens
        FOR SELECT TO selfheal_app, selfheal_readonly
        USING (public.app_access_scope() = 'PLATFORM_ADMIN');
    END IF;
  END IF;
END $$;
