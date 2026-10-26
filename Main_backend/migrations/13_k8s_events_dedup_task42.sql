-- ====================================================================
-- Migration: 13_k8s_events_dedup_task42.sql
-- Mô tả: Task [S4][PB18] 4.2 – Kubernetes Events Schema, Deduplication,
-- Unique Constraint, Ingestion Upsert & Performance Indexes.
-- ====================================================================

-- 1. Bổ sung các cột định danh event_uid, dedup_hash và audit timestamp
ALTER TABLE kubernetes_events
    ADD COLUMN IF NOT EXISTS event_uid VARCHAR(255),
    ADD COLUMN IF NOT EXISTS dedup_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reporting_controller VARCHAR(100),
    ADD COLUMN IF NOT EXISTS action VARCHAR(100),
    ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill dedup_hash cho các bản ghi sự kiện đã lưu trước đó
UPDATE kubernetes_events
SET dedup_hash = md5(
  COALESCE(cluster_id::text, 'no-cluster') || ':' ||
  COALESCE(metadata->>'namespace', 'default') || ':' ||
  COALESCE(resource_type, 'Pod') || ':' ||
  COALESCE(resource_uid, '') || ':' ||
  COALESCE(reason, 'General') || ':' ||
  substring(COALESCE(message, ''), 1, 200)
)
WHERE dedup_hash IS NULL;

-- 3. Khử trùng lặp an toàn các bản ghi cũ trước khi tạo Unique Constraint
DELETE FROM kubernetes_events a
USING kubernetes_events b
WHERE a.id < b.id
  AND a.cluster_id = b.cluster_id
  AND a.dedup_hash = b.dedup_hash;

-- 4. Tạo Unique Index chống trùng lặp sự kiện (Idempotency Key per Cluster)
CREATE UNIQUE INDEX IF NOT EXISTS idx_k8s_events_cluster_dedup
    ON kubernetes_events(cluster_id, dedup_hash);

-- 5. Tạo Partial Index cho event_uid chuẩn từ Kubernetes API
CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_event_uid
    ON kubernetes_events(cluster_id, event_uid)
    WHERE event_uid IS NOT NULL;

-- 6. Composite Indexes tối ưu truy vấn bộ lọc và phân trang theo thời gian
CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_type_time
    ON kubernetes_events(cluster_id, event_type, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_ns_time
    ON kubernetes_events(cluster_id, namespace_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_last_seen
    ON kubernetes_events(cluster_id, last_seen_at DESC, id DESC);
