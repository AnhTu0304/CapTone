-- no-transaction
-- Rollback Migration 34: Drop additional logs performance indexes

DROP INDEX CONCURRENTLY IF EXISTS public.idx_logs_meta_service_occurred;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_logs_cluster_occurred;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_logs_pod_occurred;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_logs_meta_pod_occurred;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_logs_level_occurred;
