-- ====================================================================
-- Migration: 10_enhance_node_metrics_task43.sql
-- Mô tả: Bổ sung khóa ngữ cảnh tenant (organization_id, environment_id),
--        unique index chống trùng lặp khi Agent retry (agent_id, node_name, collected_at)
--        và composite indexes tối ưu truy vấn phân trang cho bảng node_metrics (Task 4.3).
-- ====================================================================

ALTER TABLE node_metrics
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;

-- Khử trùng lặp dữ liệu cũ (nếu có) trước khi tạo unique index
DELETE FROM node_metrics a
USING node_metrics b
WHERE a.id < b.id
  AND a.agent_id = b.agent_id
  AND a.node_name = b.node_name
  AND a.collected_at = b.collected_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_metrics_dedup
    ON node_metrics(agent_id, node_name, collected_at);

CREATE INDEX IF NOT EXISTS idx_node_metrics_org_time
    ON node_metrics(organization_id, collected_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_node_metrics_node_id_time
    ON node_metrics(node_id, collected_at DESC, id DESC);
