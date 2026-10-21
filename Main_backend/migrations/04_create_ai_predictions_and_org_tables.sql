-- ====================================================================
-- Migration: 04_create_ai_predictions_and_org_tables.sql
-- Mô tả: Khởi tạo bảng Organizations, Environments, Clusters, AI Predictions,
--       Prediction Inputs, RCA Evidences và nạp seed data cho AI Self-Healing
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng `organizations`
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng `environments`
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    env_type VARCHAR(50) DEFAULT 'PRODUCTION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng `clusters`
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) DEFAULT 'MINIKUBE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng `ai_predictions`: Lưu kết quả dự đoán rủi ro từ mạng nơ-ron GRU
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
    environment_id UUID NOT NULL,
    cluster_id VARCHAR(255),
    workload_id UUID REFERENCES workloads(id) ON DELETE SET NULL,
    prediction_type VARCHAR(100) NOT NULL,
    risk_score NUMERIC(5,4),
    confidence_score NUMERIC(5,4),
    prediction_horizon_minutes INTEGER,
    status VARCHAR(30) DEFAULT 'PENDING',
    predicted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    actual_outcome VARCHAR(100),
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_model ON ai_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_status ON ai_predictions(status);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_predicted_at ON ai_predictions(predicted_at DESC);

-- 5. Bảng `prediction_inputs`: Lưu các điểm dữ liệu metric đầu vào 12x8 chuỗi thời gian
CREATE TABLE IF NOT EXISTS prediction_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES ai_predictions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    unit VARCHAR(50),
    source VARCHAR(100) DEFAULT 'agent_metrics',
    collected_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prediction_inputs_pred ON prediction_inputs(prediction_id);

-- 6. Bảng `rca_evidences`: Lưu bằng chứng hỗ trợ kết luận nguyên nhân gốc rễ
CREATE TABLE IF NOT EXISTS rca_evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_analysis_id UUID NOT NULL REFERENCES rca_analyses(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_reference TEXT,
    evidence_data JSONB DEFAULT '{}'::JSONB,
    importance_score NUMERIC(5,4) DEFAULT 0.9000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rca_evidences_analysis ON rca_evidences(rca_analysis_id);

-- ====================================================================
-- SEED DATA
-- ====================================================================

-- 1. Organization mặc định
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'SME Retail Enterprise', 'sme-retail')
ON CONFLICT (id) DO NOTHING;

-- 2. Environment mặc định (khớp với environment_id của Agent)
INSERT INTO environments (id, organization_id, name, env_type)
VALUES ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Production Kubernetes', 'PRODUCTION')
ON CONFLICT (id) DO NOTHING;

-- 3. Cluster mặc định (khớp với cluster-k8s-sme-01)
INSERT INTO clusters (id, environment_id, name, provider)
VALUES ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'cluster-k8s-sme-01', 'MINIKUBE')
ON CONFLICT (id) DO NOTHING;

-- 4. Danh mục hành động tự chữa lành (healing_action_types)
INSERT INTO healing_action_types (id, name, description)
VALUES 
  ('d0000000-0000-0000-0000-000000000001', 'Restart Pod', 'Khởi động lại Pod bị lỗi hoặc treo tiến trình'),
  ('d0000000-0000-0000-0000-000000000002', 'Scale Replicas', 'Tăng số lượng bản sao Pod để giảm tải hệ thống'),
  ('d0000000-0000-0000-0000-000000000003', 'Rollback Deployment', 'Quay lại phiên bản deployment ổn định trước đó'),
  ('d0000000-0000-0000-0000-000000000004', 'Cleanup Temporary Files', 'Dọn dẹp tệp tin tạm và giải phóng bộ nhớ lưu trữ'),
  ('d0000000-0000-0000-0000-000000000005', 'Temporary IP Block', 'Tạm thời chặn nguồn lưu lượng gây bất thường')
ON CONFLICT (name) DO NOTHING;
