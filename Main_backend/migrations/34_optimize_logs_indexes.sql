-- no-transaction
-- =============================================================================
-- Migration 34: Logs Performance Indexes (JSONB service_id, cluster, pod, level)
-- Purpose: Eliminate full-table sequential scans on public.logs during
--          RCA prioritization (findPrioritizedByService) and Log Explorer queries.
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_meta_service_occurred
  ON public.logs USING btree ((metadata->>'service_id'), occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_cluster_occurred
  ON public.logs USING btree (cluster_id, occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_pod_occurred
  ON public.logs USING btree (pod_id, occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_meta_pod_occurred
  ON public.logs USING btree ((metadata->>'pod_name'), occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_level_occurred
  ON public.logs USING btree (level, occurred_at DESC);
