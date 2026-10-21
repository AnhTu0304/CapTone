-- ====================================================================
-- Migration: 03_init_agents_telemetry_and_seed.sql
-- Mô tả: Khởi tạo bảng Agents, Tokens, Logs, Events, Workloads, AI & Dữ liệu mẫu
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng `agents`: Lưu thông tin các Kubernetes Agent kết nối về hệ thống
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    agent_uid VARCHAR(255) UNIQUE NOT NULL,
    cluster_id VARCHAR(255),
    environment_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_uid ON agents(agent_uid);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- 2. Bảng `agent_tokens`: Lưu trữ Token xác thực của Agent (hỗ trợ hash SHA-256 hoặc raw token)
CREATE TABLE IF NOT EXISTS agent_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash ON agent_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent ON agent_tokens(agent_id);

-- 3. Bảng `agent_heartbeats`: Lưu lịch sử nhịp tim / kết nối WebSocket
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    agent_version VARCHAR(50) DEFAULT '1.0.0',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON agent_heartbeats(agent_id, reported_at DESC);

-- 4. Bảng `logs`: Lưu trữ logs thời gian thực từ container / pods
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    cluster_id VARCHAR(255),
    service_id VARCHAR(255),
    level VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100) DEFAULT 'k8s-agent',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_service_occurred ON logs(service_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- 5. Bảng `kubernetes_events`: Lưu trữ cảnh báo sự kiện cụm K8s (OOMKilled, CrashLoopBackOff...)
CREATE TABLE IF NOT EXISTS kubernetes_events (
    id BIGSERIAL PRIMARY KEY,
    cluster_id VARCHAR(255),
    resource_type VARCHAR(100) DEFAULT 'Pod',
    resource_uid VARCHAR(255),
    event_type VARCHAR(50),
    reason VARCHAR(100),
    message TEXT,
    source_component VARCHAR(100) DEFAULT 'k8s-agent',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count INT DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_k8s_events_resource ON kubernetes_events(resource_uid, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_k8s_events_reason ON kubernetes_events(reason);

-- 6. Bảng `workloads`: Danh mục dịch vụ / deployments
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cluster_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workloads_name ON workloads(name);

-- 7. Bảng `ai_models`: Đăng ký mô hình AI (GRU / RCA)
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bảng `incidents`: Quản lý sự cố tự phục hồi
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    environment_id UUID NOT NULL,
    cluster_id VARCHAR(255),
    prediction_id UUID,
    source_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(255),
    incident_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);

-- 9. Bảng `rca_analyses`: Kết quả phân tích nguyên nhân gốc
CREATE TABLE IF NOT EXISTS rca_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    root_cause_type VARCHAR(100) NOT NULL,
    root_cause_description TEXT NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    analysis_method VARCHAR(100) DEFAULT 'AI_DETERMINISTIC_RULES',
    analysis_result TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Bảng `healing_action_types` và `ai_recommendations`
CREATE TABLE IF NOT EXISTS healing_action_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    rca_analysis_id UUID NOT NULL REFERENCES rca_analyses(id) ON DELETE CASCADE,
    prediction_id UUID,
    action_type_id UUID REFERENCES healing_action_types(id),
    recommendation TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    risk_level VARCHAR(50) DEFAULT 'LOW',
    priority INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- DỮ LIỆU MẪU (SEED DATA)
-- ====================================================================

-- 1. AI Model mặc định
INSERT INTO ai_models (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'GRU_RISK_CLASSIFICATION', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Đăng ký Agent mẫu cho Doanh nghiệp
INSERT INTO agents (id, name, agent_uid, cluster_id, environment_id, status, last_seen_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Production K8s SME Agent',
    'captone-agent-default',
    'cluster-k8s-sme-01',
    'e0000000-0000-0000-0000-000000000001',
    'ONLINE',
    NOW()
)
ON CONFLICT (agent_uid) DO UPDATE
SET status = 'ONLINE', last_seen_at = NOW();

-- 3. Cấp Token Agent mẫu
-- Token: cpt_sec_demo_token_2026_change_me
-- SHA-256: 7119ac14ceb8f5b908262a253c96011341843ca57f025e482cade4f859e05afc
DELETE FROM agent_tokens WHERE agent_id = 'a0000000-0000-0000-0000-000000000001';

INSERT INTO agent_tokens (id, agent_id, token_hash, expires_at, created_at)
VALUES
  -- Cả dạng SHA-256 lẫn dạng Plaintext để đảm bảo khớp 100%
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '7119ac14ceb8f5b908262a253c96011341843ca57f025e482cade4f859e05afc', NOW() + INTERVAL '365 days', NOW()),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cpt_sec_demo_token_2026_change_me', NOW() + INTERVAL '365 days', NOW()),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sh_sec_demo_token_change_me_in_production', NOW() + INTERVAL '365 days', NOW()),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '879fb60445897373ff2ef309326af711eebb639d088f2e7a054a06a705c4840c', NOW() + INTERVAL '365 days', NOW());

-- 4. Workload mẫu
INSERT INTO workloads (id, name, cluster_id)
VALUES ('c0000000-0000-0000-0000-000000000001', 'order-service', 'cluster-k8s-sme-01')
ON CONFLICT (id) DO NOTHING;

-- 5. Chèn 15 điểm Telemetry mẫu (để Dashboard có biểu đồ sóng CPU/RAM ngay lập tức)
INSERT INTO agent_metrics (agent_id, cluster_id, service_id, pod_id, cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at)
SELECT
    'a0000000-0000-0000-0000-000000000001',
    'cluster-k8s-sme-01',
    'order-service',
    'order-service-7f8d6c8b9-x2k4j',
    ROUND((40 + (random() * 35))::numeric, 2), -- CPU từ 40% -> 75%
    ROUND((55 + (random() * 25))::numeric, 2), -- RAM từ 55% -> 80%
    45.2,
    ROUND((200 + (random() * 400))::numeric, 2), -- 200 -> 600 req/s
    ROUND((30 + (random() * 150))::numeric, 2), -- Latency 30ms -> 180ms
    ROUND((random() * 0.8)::numeric, 2),
    0,
    3,
    NOW() - (i || ' minutes')::interval
FROM generate_series(0, 15) AS i;

-- 6. Chèn logs mẫu
INSERT INTO logs (cluster_id, service_id, level, message, source, occurred_at)
VALUES
    ('cluster-k8s-sme-01', 'order-service', 'INFO', 'CapTone Agent connected successfully to cluster telemetry stream', 'captone-agent', NOW() - INTERVAL '15 minutes'),
    ('cluster-k8s-sme-01', 'order-service', 'INFO', 'Service order-service health check passed (HTTP 200)', 'order-service', NOW() - INTERVAL '10 minutes'),
    ('cluster-k8s-sme-01', 'order-service', 'WARN', 'High memory consumption detected: order-service pod utilization > 78%', 'captone-agent', NOW() - INTERVAL '5 minutes'),
    ('cluster-k8s-sme-01', 'order-service', 'INFO', 'Database connection pool active: 18/20 connections', 'order-service', NOW() - INTERVAL '2 minutes'),
    ('cluster-k8s-sme-01', 'order-service', 'INFO', 'Agent metrics synchronization completed with 0 errors', 'captone-agent', NOW());

-- 7. Chèn sự kiện K8s mẫu
INSERT INTO kubernetes_events (cluster_id, resource_type, resource_uid, event_type, reason, message, source_component, first_seen_at, last_seen_at, count)
VALUES
    ('cluster-k8s-sme-01', 'Pod', 'order-service-7f8d6c8b9-x2k4j', 'Normal', 'Scheduled', 'Successfully assigned default/order-service-7f8d6c8b9-x2k4j to minikube', 'default-scheduler', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 1),
    ('cluster-k8s-sme-01', 'Pod', 'order-service-7f8d6c8b9-x2k4j', 'Normal', 'Pulled', 'Container image "order-service:1.0" already present on machine', 'kubelet', NOW() - INTERVAL '29 minutes', NOW() - INTERVAL '29 minutes', 1),
    ('cluster-k8s-sme-01', 'Pod', 'order-service-7f8d6c8b9-x2k4j', 'Normal', 'Started', 'Started container order-service', 'kubelet', NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes', 1);
