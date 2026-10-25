-- ====================================================================
-- Migration: 09_create_node_metrics.sql
-- Mô tả: Thiết kế bảng lưu trữ Node/Host Resource Metrics (Task 4.1)
--        cho CPU, RAM, Disk và Network I/O thu thập từ Agent theo thời gian.
-- ====================================================================

CREATE TABLE IF NOT EXISTS node_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL,
    cluster_id VARCHAR(100),
    node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    node_name VARCHAR(255) NOT NULL,
    cpu_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    cpu_cores INT NOT NULL DEFAULT 1,
    ram_total_bytes BIGINT NOT NULL DEFAULT 0,
    ram_used_bytes BIGINT NOT NULL DEFAULT 0,
    ram_available_bytes BIGINT NOT NULL DEFAULT 0,
    ram_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    disk_total_bytes BIGINT NOT NULL DEFAULT 0,
    disk_used_bytes BIGINT NOT NULL DEFAULT 0,
    disk_available_bytes BIGINT NOT NULL DEFAULT 0,
    disk_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    disk_filesystems JSONB NOT NULL DEFAULT '[]'::JSONB,
    net_rx_bytes BIGINT NOT NULL DEFAULT 0,
    net_tx_bytes BIGINT NOT NULL DEFAULT 0,
    net_rx_bytes_per_sec NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_tx_bytes_per_sec NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_interfaces JSONB NOT NULL DEFAULT '[]'::JSONB,
    collection_status VARCHAR(30) NOT NULL DEFAULT 'OK',
    collection_errors JSONB NOT NULL DEFAULT '{}'::JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_metrics_agent_time ON node_metrics(agent_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_node_time ON node_metrics(node_name, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_cluster_time ON node_metrics(cluster_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_collected_at ON node_metrics(collected_at DESC);
