-- Rollback Migration 31: Drop Refresh Token & Session Tables and User Token Version Columns
DROP TABLE IF EXISTS public.refresh_tokens;
DROP TABLE IF EXISTS public.user_sessions;
ALTER TABLE public.users
  DROP COLUMN IF EXISTS password_changed_at,
  DROP COLUMN IF EXISTS token_version;
