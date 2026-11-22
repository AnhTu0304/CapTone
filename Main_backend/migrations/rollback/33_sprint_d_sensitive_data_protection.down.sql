-- Rollback: 33_sprint_d_sensitive_data_protection.sql
DROP POLICY IF EXISTS sc_platform_admin_select ON public.approval_email_tokens;
DROP POLICY IF EXISTS sc_tenant_isolation ON public.approval_email_tokens;
DROP TABLE IF EXISTS public.approval_email_tokens;
