-- ====================================================================
-- Migration: 12_metrics_history_dedup_task21.sql
-- Mô tả: Task [S4][PB16] 2.1 & 2.2 – Metrics History Schema, Index, Ingestion & Deduplication
-- Bổ sung trường định danh tenant (organization_id, environment_id), 
-- kiểm toán ingestion (batch_id, sample_id), unique index chống trùng lặp
-- và composite indexes phục vụ truy vấn lịch sử viễn trắc đa chiều.
-- ====================================================================

-- 1. Bổ sung các cột định danh tenant và kiểm toán batch/sample
ALTER TABLE agent_metrics
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sample_id VARCHAR(100);

-- 2. Khử trùng lặp dữ liệu cũ trước khi tạo unique index
DELETE FROM agent_metrics a
USING agent_metrics b
WHERE a.id < b.id
  AND a.agent_id = b.agent_id
  AND a.service_id = b.service_id
  AND a.pod_id = b.pod_id
  AND a.collected_at = b.collected_at;

-- 3. Tạo unique index chống trùng lặp dữ liệu (Deduplication natural key)
-- Đảm bảo cùng agent, service, pod và thời điểm đo chỉ lưu duy nhất 1 bản ghi
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_dedup
    ON agent_metrics(agent_id, service_id, pod_id, collected_at);

-- 4. Tạo partial unique index cho sample_id nếu client cung cấp định danh sample rõ ràng
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_sample_id
    ON agent_metrics(sample_id)
    WHERE sample_id IS NOT NULL;

-- 5. Composite indexes tối ưu hóa truy vấn lịch sử và cách ly tenant
CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_time
    ON agent_metrics(organization_id, collected_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_service_time
    ON agent_metrics(organization_id, service_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_pod_time
    ON agent_metrics(service_id, pod_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_cluster_time
    ON agent_metrics(cluster_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_batch_id
    ON agent_metrics(batch_id)
    WHERE batch_id IS NOT NULL;

-- 6. Backfill dữ liệu tenant cho các bản ghi cũ
UPDATE agent_metrics
SET
  environment_id = COALESCE(agent_metrics.environment_id, a.environment_id),
  organization_id = COALESCE(agent_metrics.organization_id, e.organization_id)
FROM agents a
LEFT JOIN environments e ON e.id = a.environment_id
WHERE (agent_metrics.organization_id IS NULL OR agent_metrics.environment_id IS NULL)
  AND (a.id::text = agent_metrics.agent_id::text OR a.agent_uid = agent_metrics.agent_id::text);
