-- ====================================================================
-- Migration: 02_create_agent_metrics.sql
-- Mô tả: Tạo bảng lưu trữ metric thô từ các pod/agent giám sát
-- Áp dụng cho: aiselfheal / captone_db
-- ====================================================================

CREATE TABLE IF NOT EXISTS agent_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL,
    cluster_id VARCHAR(100),
    service_id VARCHAR(100) NOT NULL,
    pod_id VARCHAR(100) NOT NULL,
    cpu NUMERIC(6, 2) NOT NULL DEFAULT 0,
    ram NUMERIC(6, 2) NOT NULL DEFAULT 0,
    disk NUMERIC(6, 2) NOT NULL DEFAULT 0,
    request_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    latency NUMERIC(10, 2) NOT NULL DEFAULT 0,
    http_5xx_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
    pod_restart_count INT NOT NULL DEFAULT 0,
    replica_count INT NOT NULL DEFAULT 1,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_collected ON agent_metrics(service_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_collected_at ON agent_metrics(collected_at DESC);
