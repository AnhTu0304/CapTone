-- ====================================================================
-- SelfHeal Platform - MASTER CONSOLIDATED DATABASE MIGRATION
-- File: 00_init_full_database.sql
-- Mô tả: File migration tổng hợp duy nhất, khởi tạo toàn bộ CSDL (25 bảng),
--       mở rộng, ENUM, ràng buộc khoá ngoại, chỉ mục (indexes) và seed data.
-- Phiên bản: 1.1 (Consolidated with Profile & Multi-admin Seeds)
-- Cơ sở dữ liệu: PostgreSQL 14+ (captone_db / aiselfheal)
-- ====================================================================

-- ====================================================================
-- PHẦN 1: TIỆN ÍCH MỞ RỘNG (EXTENSIONS)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- PHẦN 2: CÁC KIỂU DỮ LIỆU TÙY BIẾN (CUSTOM ENUM TYPES)
-- ====================================================================
DO $$
BEGIN
    -- Kiểu trạng thái tài khoản người dùng
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;

    -- Kiểu trạng thái của tổ chức (Doanh nghiệp)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;

    -- Kiểu trạng thái thành viên trong tổ chức
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE member_status AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'REMOVED');
    END IF;
END $$;

-- ====================================================================
-- PHẦN 3: BẢNG QUẢN LÝ NGƯỜI DÙNG & VAI TRÒ HỆ THỐNG
-- ====================================================================

-- 1. Bảng `users`: Tài khoản người dùng toàn hệ thống
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    full_name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    job_title VARCHAR(100),
    status user_status NOT NULL DEFAULT 'PENDING',
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- 2. Bảng `email_verification_tokens`: Token xác thực OTP kích hoạt email
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- 3. Bảng `system_roles`: Danh mục vai trò quản trị cấp nền tảng (Platform Level)
CREATE TABLE IF NOT EXISTS system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng `user_system_roles`: Phân quyền vai trò hệ thống cho người dùng
CREATE TABLE IF NOT EXISTS user_system_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    system_role_id UUID NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, system_role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_system_roles_user ON user_system_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_system_roles_role ON user_system_roles(system_role_id);

-- ====================================================================
-- PHẦN 4: TỔ CHỨC, HỒ SƠ TỔ CHỨC, VAI TRÒ & THÀNH VIÊN
-- ====================================================================

-- 5. Bảng `roles`: Vai trò áp dụng trong phạm vi tổ chức (Organization Level)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Bảng `organizations`: Danh mục các doanh nghiệp / tổ chức
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    description TEXT,
    status organization_status NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- 7. Bảng `organization_profiles`: Thông tin hồ sơ chi tiết của tổ chức
CREATE TABLE IF NOT EXISTS organization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(30),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bảng `organization_members`: Danh sách thành viên và phân quyền trong tổ chức
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    status member_status NOT NULL DEFAULT 'INVITED',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- ====================================================================
-- PHẦN 5: HẠ TẦNG K8S & MÔI TRƯỜNG TRIỂN KHAI
-- ====================================================================

-- 9. Bảng `environments`: Các môi trường (Production, Staging, Dev...)
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    env_type VARCHAR(50) DEFAULT 'PRODUCTION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_environments_org ON environments(organization_id);

-- 10. Bảng `clusters`: Quản lý cụm Kubernetes
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) DEFAULT 'MINIKUBE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clusters_env ON clusters(environment_id);

-- 11. Bảng `workloads`: Dịch vụ, Microservices hoặc Pod Deployments
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cluster_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workloads_name ON workloads(name);

-- ====================================================================
-- PHẦN 6: AGENT K8S, TOKENS, HEARTBEATS & DỮ LIỆU TELEMETRY
-- ====================================================================

-- 12. Bảng `agents`: Danh sách Kubernetes Agent giám sát
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

-- 13. Bảng `agent_tokens`: Token bảo mật dùng kết nối WebSocket
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

-- 14. Bảng `agent_heartbeats`: Lịch sử nhịp tim kiểm tra tính khả dụng
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    agent_version VARCHAR(50) DEFAULT '1.0.0',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON agent_heartbeats(agent_id, reported_at DESC);

-- 15. Bảng `agent_metrics`: Dữ liệu đo đạc tài nguyên thời gian thực (CPU, RAM, Disk, Latency...)
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

-- 16. Bảng `logs`: Nhật ký vận hành từ Pods và Services
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

-- 17. Bảng `kubernetes_events`: Sự kiện từ Control Plane K8s (CrashLoopBackOff, Evicted, OOM...)
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

-- ====================================================================
-- PHẦN 7: AI MODELS, DỰ ĐOÁN (GRU), SỰ CỐ & TỰ PHỤC HỒI (SELF-HEALING)
-- ====================================================================

-- 18. Bảng `ai_models`: Quản lý phiên bản mô hình AI (GRU / RCA / Predictor)
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Bảng `ai_predictions`: Kết quả dự đoán bất thường từ mạng nơ-ron GRU
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

-- 20. Bảng `prediction_inputs`: Chi tiết chuỗi thời gian đầu vào phục vụ mô hình GRU
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

-- 21. Bảng `incidents`: Quản lý sự cố cần tự phục hồi
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

-- 22. Bảng `rca_analyses`: Phân tích nguyên nhân gốc rễ (Root Cause Analysis)
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

-- 23. Bảng `rca_evidences`: Bằng chứng củng cố kết luận RCA
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

-- 24. Bảng `healing_action_types`: Danh mục hành động khắc phục lỗi tự động
CREATE TABLE IF NOT EXISTS healing_action_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. Bảng `ai_recommendations`: Các khuyến nghị hành động chữa lành từ AI
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
-- PHẦN 8: SEED DATA MẶC ĐỊNH & KHỞI TẠO NỀN TẢNG
-- ====================================================================

-- 1. Vai trò Quản trị Hệ thống (System Roles)
INSERT INTO system_roles (id, name, description) VALUES
    ('b92b76b6-8734-4bef-a112-3336e3c4959c', 'SUPER_ADMIN', 'Quản trị viên tối cao toàn hệ thống với mọi quyền hạn'),
    ('285152e9-1403-4ca3-b5e2-5b8c37026969', 'SYSTEM_ADMIN', 'Quản trị viên kỹ thuật, quản lý cụm, agent và chính sách'),
    ('6158cda2-8451-41fb-8e02-3d8574c31c89', 'ADMIN', 'Quản trị viên vận hành hệ thống và duyệt hành động phục hồi'),
    ('e4395420-07bf-4ee2-b88d-71b56372b66f', 'USER', 'Người dùng thông thường, người vận hành theo dõi hệ thống')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, updated_at = NOW();

-- 2. Vai trò cấp Tổ chức (Organization Roles)
INSERT INTO roles (code, name, description, scope) VALUES
    ('ADMIN', 'Platform Admin', 'Quản trị toàn bộ nền tảng', 'PLATFORM'),
    ('SME_OWNER', 'SME Owner', 'Quản lý tổ chức và kiểm soát self-healing', 'ORGANIZATION'),
    ('DEVOPS', 'DevOps', 'Quản lý hạ tầng, agent và vận hành kỹ thuật', 'ORGANIZATION'),
    ('VIEWER', 'Viewer', 'Chỉ xem dữ liệu được cấp quyền', 'ORGANIZATION')
ON CONFLICT (code) DO NOTHING;

-- 3. Tài khoản Quản trị viên Super Admin mặc định
-- Tài khoản 1: phamthaisang1710@gmail.com (Mật khẩu: Admin@123)
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
VALUES (
    'd3a26d55-0b9f-48e7-a328-846badf96cd7',
    'phamthaisang1710@gmail.com',
    '$2b$10$APWkvgW0lABeeSJJR0u8ru4uj8oKZymvphd5b3TM4kGbP3d6vV8Ey',
    'Phạm Thái Sang (Super Admin)',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Tài khoản 2: superadmin@selfheal.com (Mật khẩu: AdminPassword123@)
INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
VALUES (
    'superadmin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Tối Cao (Super Admin)',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = crypt('AdminPassword123@', gen_salt('bf', 10)),
    status = 'ACTIVE',
    email_verified_at = COALESCE(users.email_verified_at, NOW()),
    updated_at = NOW();

-- Tài khoản 3: admin@selfheal.com (Mật khẩu: AdminPassword123@)
INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
VALUES (
    'admin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Vận Hành (Admin)',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = crypt('AdminPassword123@', gen_salt('bf', 10)),
    status = 'ACTIVE',
    email_verified_at = COALESCE(users.email_verified_at, NOW()),
    updated_at = NOW();

-- Gán quyền SUPER_ADMIN / ADMIN cho các tài khoản quản trị
INSERT INTO user_system_roles (user_id, system_role_id)
SELECT u.id, sr.id
FROM users u, system_roles sr
WHERE u.email IN ('phamthaisang1710@gmail.com', 'superadmin@selfheal.com') AND sr.name = 'SUPER_ADMIN'
ON CONFLICT (user_id, system_role_id) DO NOTHING;

INSERT INTO user_system_roles (user_id, system_role_id)
SELECT u.id, sr.id
FROM users u, system_roles sr
WHERE u.email = 'admin@selfheal.com' AND sr.name = 'ADMIN'
ON CONFLICT (user_id, system_role_id) DO NOTHING;

-- 4. Tổ chức Doanh nghiệp mẫu mặc định
INSERT INTO organizations (id, name, slug, type, description, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SME Retail Enterprise',
    'sme-retail',
    'Enterprise',
    'Doanh nghiệp Bán lẻ SME Retail Enterprise mẫu',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Hồ sơ tổ chức mặc định
INSERT INTO organization_profiles (organization_id, description, email, timezone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Doanh nghiệp Bán lẻ SME Retail Enterprise',
    'contact@smeretail.com',
    'Asia/Ho_Chi_Minh'
)
ON CONFLICT (organization_id) DO NOTHING;

-- 6. Gán Admin làm SME_OWNER của tổ chức mặc định
DO $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'phamthaisang1710@gmail.com' LIMIT 1;
    SELECT id INTO v_role_id FROM roles WHERE code = 'SME_OWNER' LIMIT 1;
    
    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
        VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, v_role_id, 'ACTIVE', NOW())
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
END $$;

-- 7. Môi trường mặc định
INSERT INTO environments (id, organization_id, name, env_type)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Production Kubernetes',
    'PRODUCTION'
)
ON CONFLICT (id) DO NOTHING;

-- 8. Cụm K8s mặc định
INSERT INTO clusters (id, environment_id, name, provider)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'cluster-k8s-sme-01',
    'MINIKUBE'
)
ON CONFLICT (id) DO NOTHING;

-- 9. Workload dịch vụ mẫu
INSERT INTO workloads (id, name, cluster_id)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'order-service',
    'cluster-k8s-sme-01'
)
ON CONFLICT (id) DO NOTHING;

-- 10. Danh mục các hành động tự phục hồi (Healing Action Types)
INSERT INTO healing_action_types (id, name, description)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'Restart Pod', 'Khởi động lại Pod bị lỗi hoặc treo tiến trình'),
    ('d0000000-0000-0000-0000-000000000002', 'Scale Replicas', 'Tăng số lượng bản sao Pod để giảm tải hệ thống'),
    ('d0000000-0000-0000-0000-000000000003', 'Rollback Deployment', 'Quay lại phiên bản deployment ổn định trước đó'),
    ('d0000000-0000-0000-0000-000000000004', 'Cleanup Temporary Files', 'Dọn dẹp tệp tin tạm và giải phóng bộ nhớ lưu trữ'),
    ('d0000000-0000-0000-0000-000000000005', 'Temporary IP Block', 'Tạm thời chặn nguồn lưu lượng gây bất thường')
ON CONFLICT (name) DO NOTHING;

-- 11. AI Model GRU phân loại rủi ro
INSERT INTO ai_models (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'GRU_RISK_CLASSIFICATION', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 12. K8s Agent mẫu cho doanh nghiệp
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

-- 13. Token xác thực Agent
INSERT INTO agent_tokens (id, agent_id, token_hash, expires_at, created_at)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '7119ac14ceb8f5b908262a253c96011341843ca57f025e482cade4f859e05afc', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cpt_sec_demo_token_2026_change_me', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sh_sec_demo_token_change_me_in_production', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '879fb60445897373ff2ef309326af711eebb639d088f2e7a054a06a705c4840c', NOW() + INTERVAL '365 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- 14. Dữ liệu mẫu ban đầu cho Logs & Sự kiện K8s (nếu chưa có)
INSERT INTO logs (cluster_id, service_id, level, message, source, occurred_at)
SELECT 'cluster-k8s-sme-01', 'order-service', 'INFO', 'CapTone Agent connected successfully to cluster telemetry stream', 'captone-agent', NOW() - INTERVAL '15 minutes'
WHERE NOT EXISTS (SELECT 1 FROM logs LIMIT 1);

INSERT INTO kubernetes_events (cluster_id, resource_type, resource_uid, event_type, reason, message, source_component, first_seen_at, last_seen_at, count)
SELECT 'cluster-k8s-sme-01', 'Pod', 'order-service-7f8d6c8b9-x2k4j', 'Normal', 'Scheduled', 'Successfully assigned default/order-service-7f8d6c8b9-x2k4j to minikube', 'default-scheduler', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 1
WHERE NOT EXISTS (SELECT 1 FROM kubernetes_events LIMIT 1);

-- ====================================================================
-- KẾT THÚC KHỞI TẠO CƠ SỞ DỮ LIỆU CHUẨN TOÀN BỘ HỆ THỐNG
-- ====================================================================
