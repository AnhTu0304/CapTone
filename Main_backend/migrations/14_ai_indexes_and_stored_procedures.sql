-- =============================================================================
-- Migration 14: AI / GRU / RCA / Self-Healing Composite Indexes & Stored Procedures
-- Purpose: Accelerate GRU prediction history, 12-step input sequence retrieval,
--          prediction statistics, RCA recommendations, and self-healing audit queries.
-- =============================================================================

-- =============================================================================
-- PART 1: 10 COMPOSITE B-TREE INDEXES FOR AI & SELF-HEALING TABLES
-- =============================================================================

-- 1. prediction_inputs (~2.9M rows): Fast lookup & pre-sorted retrieval of 12x8 GRU inputs
CREATE INDEX IF NOT EXISTS idx_pred_inputs_pred_collected_metric
  ON public.prediction_inputs (prediction_id, collected_at ASC, metric_name ASC);

-- 2. ai_predictions: Fast pagination & filtering by cluster + time DESC
CREATE INDEX IF NOT EXISTS idx_ai_predictions_cluster_predicted
  ON public.ai_predictions (cluster_id, predicted_at DESC);

-- 3. ai_predictions: Fast filtering & stats by workload + time DESC
CREATE INDEX IF NOT EXISTS idx_ai_predictions_workload_predicted
  ON public.ai_predictions (workload_id, predicted_at DESC);

-- 4. ai_predictions: Fast multi-tenant stats & type filtering
CREATE INDEX IF NOT EXISTS idx_ai_predictions_env_type_predicted
  ON public.ai_predictions (environment_id, prediction_type, predicted_at DESC);

-- 5. ai_recommendations: Fast lookup by incident_id + priority + created_at DESC
CREATE INDEX IF NOT EXISTS idx_ai_recs_incident_priority
  ON public.ai_recommendations (incident_id, priority ASC, created_at DESC);

-- 6. ai_recommendations: Fast window function partitioning (recommendation, status, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_ai_recs_status_rec_created
  ON public.ai_recommendations (recommendation, status, created_at DESC);

-- 7. ai_recommendations: Fast lookup by rca_analysis_id & prediction_id
CREATE INDEX IF NOT EXISTS idx_ai_recs_rca_prediction
  ON public.ai_recommendations (rca_analysis_id, prediction_id);

-- 8. healing_actions: Fast pagination & status filtering (RUNNING/PENDING + history)
CREATE INDEX IF NOT EXISTS idx_healing_actions_status_created
  ON public.healing_actions (execution_status, created_at DESC);

-- 9. healing_actions: Fast join with incidents & chronological sorting
CREATE INDEX IF NOT EXISTS idx_healing_actions_incident_created
  ON public.healing_actions (incident_id, created_at DESC);

-- 10. incidents: Fast multi-tenant & target workload lookup
CREATE INDEX IF NOT EXISTS idx_incidents_org_cluster_created
  ON public.incidents (organization_id, cluster_id, created_at DESC);


-- =============================================================================
-- PART 2: STORED PROCEDURES & FUNCTIONS FOR AI / GRU / RCA HISTORY
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sp_get_gru_predictions_history
-- Single-pass paginated GRU prediction history with total_count window function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_get_gru_predictions_history(
  p_cluster_id TEXT DEFAULT NULL,
  p_org_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_prediction_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  model_id UUID,
  model_name VARCHAR,
  model_version VARCHAR,
  environment_id UUID,
  environment_name VARCHAR,
  cluster_id VARCHAR,
  cluster_name VARCHAR,
  workload_id UUID,
  workload_name VARCHAR,
  prediction_type VARCHAR,
  risk_score NUMERIC,
  confidence_score NUMERIC,
  prediction_horizon_minutes INTEGER,
  status VARCHAR,
  predicted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  risk_outputs JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.model_id,
    m.name::VARCHAR AS model_name,
    m.version::VARCHAR AS model_version,
    p.environment_id,
    e.name::VARCHAR AS environment_name,
    p.cluster_id,
    c.name::VARCHAR AS cluster_name,
    p.workload_id,
    w.name::VARCHAR AS workload_name,
    p.prediction_type,
    p.risk_score,
    p.confidence_score,
    p.prediction_horizon_minutes,
    p.status,
    p.predicted_at,
    p.expires_at,
    p.created_at,
    p.risk_outputs,
    COUNT(*) OVER() AS total_count
  FROM public.ai_predictions p
  LEFT JOIN public.ai_models m ON m.id = p.model_id
  LEFT JOIN public.environments e ON e.id = p.environment_id
  LEFT JOIN LATERAL (
    SELECT cl.name
    FROM public.clusters cl
    WHERE cl.id::text = p.cluster_id OR cl.name = p.cluster_id OR cl.cluster_uid = p.cluster_id
    LIMIT 1
  ) c ON TRUE
  LEFT JOIN public.workloads w ON w.id = p.workload_id
  WHERE
    (p_org_id IS NULL OR p_org_id = '' OR UPPER(p_org_id) = 'ALL' OR e.organization_id::text = p_org_id)
    AND (p_status IS NULL OR p_status = '' OR p.status = p_status)
    AND (p_prediction_type IS NULL OR p_prediction_type = '' OR p.prediction_type ILIKE ('%' || p_prediction_type || '%'))
    AND (
      p_cluster_id IS NULL OR p_cluster_id = '' OR UPPER(p_cluster_id) = 'ALL'
      OR p.cluster_id IN (
        SELECT cl2.id::text FROM public.clusters cl2
        WHERE cl2.id::text = p_cluster_id OR cl2.cluster_uid = p_cluster_id OR cl2.name = p_cluster_id
      )
      OR p.cluster_id = p_cluster_id
    )
  ORDER BY p.predicted_at DESC
  LIMIT COALESCE(p_limit, 20)
  OFFSET COALESCE(p_offset, 0);
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. sp_get_gru_12step_sequence
-- Fast indexed retrieval of raw and pivoted 12-step GRU telemetry sequence
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_get_prediction_inputs_raw(
  p_prediction_id UUID
)
RETURNS TABLE (
  id UUID,
  prediction_id UUID,
  metric_name VARCHAR,
  metric_value NUMERIC,
  unit VARCHAR,
  source VARCHAR,
  collected_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pi.id,
    pi.prediction_id,
    pi.metric_name,
    pi.metric_value,
    pi.unit,
    pi.source,
    pi.collected_at
  FROM public.prediction_inputs pi
  WHERE pi.prediction_id = p_prediction_id
  ORDER BY pi.collected_at ASC, pi.metric_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.sp_get_gru_12step_sequence(
  p_prediction_id UUID
)
RETURNS TABLE (
  step_index BIGINT,
  collected_at TIMESTAMPTZ,
  cpu NUMERIC,
  ram NUMERIC,
  disk NUMERIC,
  latency NUMERIC,
  request_rate NUMERIC,
  http_5xx_rate NUMERIC,
  pod_restart_count NUMERIC,
  replica_count NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY pi.collected_at ASC) AS step_index,
    pi.collected_at,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'cpu'), 0) AS cpu,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'ram'), 0) AS ram,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'disk'), 0) AS disk,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'latency'), 0) AS latency,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'request_rate'), 0) AS request_rate,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'http_5xx_rate'), 0) AS http_5xx_rate,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'pod_restart_count'), 0) AS pod_restart_count,
    COALESCE(MAX(pi.metric_value) FILTER (WHERE pi.metric_name = 'replica_count'), 0) AS replica_count
  FROM public.prediction_inputs pi
  WHERE pi.prediction_id = p_prediction_id
  GROUP BY pi.collected_at
  ORDER BY pi.collected_at ASC;
$$;


-- -----------------------------------------------------------------------------
-- 3. sp_get_ai_prediction_stats
-- Single-call aggregated statistics for AI Predictions header cards
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_get_ai_prediction_stats(
  p_cluster_id TEXT DEFAULT NULL,
  p_workload TEXT DEFAULT NULL,
  p_org_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total BIGINT := 0;
  v_avg_conf NUMERIC := 0;
  v_by_type JSONB := '{}'::JSONB;
BEGIN
  WITH filtered AS (
    SELECT p.prediction_type, p.confidence_score
    FROM public.ai_predictions p
    LEFT JOIN public.environments e ON e.id = p.environment_id
    WHERE
      (p_org_id IS NULL OR p_org_id = '' OR UPPER(p_org_id) = 'ALL' OR e.organization_id::text = p_org_id)
      AND (
        p_cluster_id IS NULL OR p_cluster_id = '' OR UPPER(p_cluster_id) = 'ALL'
        OR p.cluster_id IN (
          SELECT cl.id::text FROM public.clusters cl
          WHERE cl.id::text = p_cluster_id OR cl.cluster_uid = p_cluster_id OR cl.name = p_cluster_id
        )
        OR p.cluster_id = p_cluster_id
      )
      AND (
        p_workload IS NULL OR p_workload = '' OR UPPER(p_workload) = 'ALL'
        OR p.workload_id IN (SELECT w.id FROM public.workloads w WHERE w.name = p_workload)
        OR p.workload_id::text = p_workload
      )
  ),
  type_counts AS (
    SELECT prediction_type, COUNT(*) AS cnt
    FROM filtered
    WHERE prediction_type IS NOT NULL
    GROUP BY prediction_type
  ),
  summary AS (
    SELECT COUNT(*) AS total_cnt, COALESCE(AVG(confidence_score), 0) AS avg_c
    FROM filtered
  )
  SELECT
    s.total_cnt,
    s.avg_c,
    COALESCE((SELECT jsonb_object_agg(tc.prediction_type, tc.cnt) FROM type_counts tc), '{}'::JSONB)
  INTO v_total, v_avg_conf, v_by_type
  FROM summary s;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'by_type', COALESCE(v_by_type, '{}'::JSONB),
    'avg_confidence', ROUND(COALESCE(v_avg_conf, 0)::numeric, 4)
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. sp_get_ai_recommendations_paginated
-- Fast ranked & paginated AI & RCA recommendations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_get_ai_recommendations_paginated(
  p_limit INTEGER DEFAULT 20,
  p_cluster_id TEXT DEFAULT NULL,
  p_org_id TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  incident_id UUID,
  rca_analysis_id UUID,
  prediction_id UUID,
  action_type_id UUID,
  action_code VARCHAR,
  action_name VARCHAR,
  recommendation TEXT,
  reasoning TEXT,
  risk_level VARCHAR,
  priority INTEGER,
  status VARCHAR,
  created_at TIMESTAMPTZ,
  cluster_id VARCHAR,
  target_name TEXT,
  target_id TEXT,
  incident_title VARCHAR,
  analysis_result TEXT,
  action_parameters JSONB,
  manual_playbook JSONB,
  root_cause_type VARCHAR,
  rca_confidence NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_recs AS (
    SELECT
      r.id,
      r.incident_id,
      r.rca_analysis_id,
      r.prediction_id,
      r.action_type_id,
      h.code::VARCHAR AS action_code,
      h.name::VARCHAR AS action_name,
      r.recommendation,
      r.reasoning,
      r.risk_level,
      r.priority,
      r.status,
      r.created_at,
      i.cluster_id,
      COALESCE(w.name, NULLIF(i.target_id::text, ''), '')::TEXT AS target_name,
      COALESCE(w.name, NULLIF(i.target_id::text, ''), '')::TEXT AS target_id,
      i.title AS incident_title,
      rca.analysis_result,
      CASE
        WHEN rca.analysis_result IS NOT NULL AND rca.analysis_result <> ''
        THEN (rca.analysis_result::jsonb->'recommendation'->'action_parameters')
        ELSE NULL
      END AS action_parameters,
      CASE
        WHEN rca.analysis_result IS NOT NULL AND rca.analysis_result <> ''
        THEN (rca.analysis_result::jsonb->'recommendation'->'action_parameters'->'manual_playbook')
        ELSE NULL
      END AS manual_playbook,
      rca.root_cause_type,
      rca.confidence_score AS rca_confidence,
      ROW_NUMBER() OVER (
        PARTITION BY r.recommendation, r.status, COALESCE(w.name, i.target_id::text, '')
        ORDER BY r.created_at DESC
      ) AS rn
    FROM public.ai_recommendations r
    LEFT JOIN public.healing_action_types h ON h.id = r.action_type_id
    LEFT JOIN public.incidents i ON r.incident_id = i.id
    LEFT JOIN LATERAL (
      SELECT wl.name
      FROM public.workloads wl
      WHERE wl.id::text = i.target_id OR wl.name = i.target_id
      LIMIT 1
    ) w ON TRUE
    LEFT JOIN public.rca_analyses rca ON rca.id = r.rca_analysis_id
    WHERE
      (
        p_org_id IS NULL OR p_org_id = '' OR UPPER(p_org_id) = 'ALL'
        OR i.organization_id::text = p_org_id
        OR EXISTS (
          SELECT 1 FROM public.environments env
          WHERE env.id = i.environment_id AND env.organization_id::text = p_org_id
        )
      )
      AND (
        p_cluster_id IS NULL OR p_cluster_id = '' OR UPPER(p_cluster_id) = 'ALL'
        OR i.cluster_id IN (
          SELECT cl.id::text FROM public.clusters cl
          WHERE cl.id::text = p_cluster_id OR cl.cluster_uid = p_cluster_id OR cl.name = p_cluster_id
        )
        OR i.cluster_id = p_cluster_id
      )
  )
  SELECT
    rr.id,
    rr.incident_id,
    rr.rca_analysis_id,
    rr.prediction_id,
    rr.action_type_id,
    rr.action_code,
    rr.action_name,
    rr.recommendation,
    rr.reasoning,
    rr.risk_level,
    rr.priority,
    rr.status,
    rr.created_at,
    rr.cluster_id,
    rr.target_name,
    rr.target_id,
    rr.incident_title,
    rr.analysis_result,
    rr.action_parameters,
    rr.manual_playbook,
    rr.root_cause_type,
    rr.rca_confidence
  FROM ranked_recs rr
  WHERE rr.rn <= 5
  ORDER BY rr.created_at DESC
  LIMIT COALESCE(p_limit, 20)
  OFFSET COALESCE(p_offset, 0);
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. sp_cleanup_old_prediction_inputs (Stored Procedure)
-- Retains prediction_inputs for the latest N predictions and purges older bloat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE public.sp_cleanup_old_prediction_inputs(
  p_keep_latest_predictions INTEGER DEFAULT 5000
)
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.prediction_inputs pi
  WHERE pi.prediction_id NOT IN (
    SELECT p.id
    FROM public.ai_predictions p
    ORDER BY p.predicted_at DESC
    LIMIT GREATEST(COALESCE(p_keep_latest_predictions, 5000), 500)
  );
END;
$$;
