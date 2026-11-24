-- Migration 31: Sprint C Phase 2 — Refresh Token Families, User Sessions & Global Token Versioning
-- Non-destructive additive migration compatible with Sprint C Phase 1 role separation.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_family ON public.user_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  parent_token_id UUID REFERENCES public.refresh_tokens(id) ON DELETE SET NULL,
  replaced_by_token_id UUID REFERENCES public.refresh_tokens(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  reuse_detected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON public.refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON public.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens(expires_at);

-- Align ownership and least-privilege grants with Sprint C Phase 1 roles if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_migrator') THEN
    ALTER TABLE public.user_sessions OWNER TO selfheal_migrator;
    ALTER TABLE public.refresh_tokens OWNER TO selfheal_migrator;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_sessions, public.refresh_tokens TO selfheal_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'selfheal_readonly') THEN
    GRANT SELECT ON TABLE public.user_sessions, public.refresh_tokens TO selfheal_readonly;
  END IF;
END
$$;
