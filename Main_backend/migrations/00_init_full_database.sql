-- ====================================================================
-- SelfHeal Platform - MASTER FULL DATABASE MIGRATION (39 TABLES)
-- File: 00_init_full_database.sql
-- Mô tả: File khởi tạo toàn bộ CSDL 39 bảng chuẩn Enterprise:
--       Tiện ích pgcrypto, 12 kiểu ENUM, 39 Bảng, Sequences, Ràng buộc,
--       Chỉ mục (Indexes) và Dữ liệu mẫu (Seed Data) đầy đủ.
-- Phiên bản: 2.0 (Complete 39-Table Enterprise Architecture)
-- Cơ sở dữ liệu: PostgreSQL 14+ (captone_db / aiselfheal)
-- ====================================================================

-- ====================================================================
-- PHẦN 1: TIỆN ÍCH MỞ RỘNG (EXTENSIONS)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- PHẦN 2: CÁC KIỂU DỮ LIỆU TÙY BIẾN (12 CUSTOM ENUM TYPES)
-- ====================================================================
DO $$
BEGIN
    -- 1. Trạng thái người dùng
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;

    -- 2. Trạng thái tổ chức
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE organization_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;

    -- 3. Trạng thái thành viên tổ chức
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE member_status AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'REMOVED');
    END IF;

    -- 4. Trạng thái Agent
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_status') THEN
        CREATE TYPE agent_status AS ENUM ('PENDING', 'ONLINE', 'OFFLINE', 'REVOKED');
    END IF;

    -- 5. Mức độ nghiêm trọng của sự cố
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
        CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;

    -- 6. Trạng thái sự cố
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
        CREATE TYPE incident_status AS ENUM ('OPEN', 'INVESTIGATING', 'MITIGATING', 'RESOLVED', 'FAILED', 'IGNORED');
    END IF;

    -- 7. Mức độ rủi ro hành động
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
        CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;

    -- 8. Chế độ thực thi tự chữa lành
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_mode') THEN
        CREATE TYPE execution_mode AS ENUM ('MANUAL', 'AUTO');
    END IF;

    -- 9. Trạng thái phê duyệt hành động
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED', 'EXPIRED');
    END IF;

    -- 10. Trạng thái thực thi hành động
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_status') THEN
        CREATE TYPE execution_status AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
    END IF;

    -- 11. Loại môi trường
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_type') THEN
        CREATE TYPE environment_type AS ENUM ('DEVELOPMENT', 'STAGING', 'TESTING', 'PRODUCTION');
    END IF;

    -- 12. Trạng thái môi trường
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_status') THEN
        CREATE TYPE environment_status AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONNECTED');
    END IF;
END $$;

-- ====================================================================
-- PHẦN 3: BẢNG QUẢN LÝ NGƯỜI DÙNG & XÁC THỰC (5 BẢNG)
-- ====================================================================

-- 1. Bảng `users`: Tài khoản người dùng
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

-- 2. Bảng `password_reset_tokens`: Quản lý yêu cầu đặt lại mật khẩu
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- 3. Bảng `email_verification_tokens`: Token xác thực OTP kích hoạt tài khoản
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- 4. Bảng `system_roles`: Vai trò quản trị cấp nền tảng
CREATE TABLE IF NOT EXISTS system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bảng `user_system_roles`: Phân quyền vai trò hệ thống cho người dùng
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
-- PHẦN 4: TỔ CHỨC, HỒ SƠ, VAI TRÒ & THÀNH VIÊN (4 BẢNG)
-- ====================================================================

-- 6. Bảng `roles`: Vai trò cấp tổ chức
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Bảng `organizations`: Danh mục các doanh nghiệp / tổ chức
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

-- 8. Bảng `organization_profiles`: Hồ sơ thông tin chi tiết của tổ chức
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

-- 9. Bảng `organization_members`: Thành viên và phân quyền trong tổ chức
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
-- PHẦN 5: NHẬT KÝ KIỂM TOÁN (AUDIT) & THÔNG BÁO (2 BẢNG)
-- ====================================================================

-- 10. Bảng `audit_logs`: Nhật ký kiểm toán bảo mật và tác vụ quản trị
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(30) NOT NULL DEFAULT 'USER',
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    target_type VARCHAR(100),
    target_id UUID,
    description TEXT,
    status VARCHAR(30) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 11. Bảng `notifications`: Quản lý thông báo người dùng và cảnh báo sự cố
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'INFO',
    related_resource_type VARCHAR(50),
    related_resource_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- ====================================================================
-- PHẦN 6: HẠ TẦNG KUBERNETES & WORKLOADS (8 BẢNG)
-- ====================================================================

-- 12. Bảng `environments`: Các môi trường vận hành (Production, Staging...)
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    env_type VARCHAR(50) DEFAULT 'PRODUCTION',
    environment_type environment_type DEFAULT 'PRODUCTION',
    status environment_status DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_environments_org ON environments(organization_id);

-- 13. Bảng `clusters`: Cụm Kubernetes quản lý
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cluster_uid VARCHAR(255),
    provider VARCHAR(50) DEFAULT 'MINIKUBE',
    endpoint TEXT,
    kubernetes_version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'CONNECTED',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clusters_env ON clusters(environment_id);

-- 14. Bảng `nodes`: Các node máy chủ vật lý / ảo hóa trong cụm K8s
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    kubernetes_uid VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    cpu_capacity_millicores BIGINT,
    memory_capacity_bytes BIGINT,
    disk_capacity_bytes BIGINT,
    kubelet_version VARCHAR(100),
    labels JSONB DEFAULT '{}'::JSONB,
    roles JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_cluster ON nodes(cluster_id);

-- 15. Bảng `namespaces`: Không gian tên phân tách logic trong cụm K8s
CREATE TABLE IF NOT EXISTS namespaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    kubernetes_uid VARCHAR(255),
    status VARCHAR(30) DEFAULT 'Active',
    labels JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_namespaces_cluster ON namespaces(cluster_id);

-- 16. Bảng `workloads`: Dịch vụ, Microservices hoặc Deployments cấp cao
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id VARCHAR(255),
    namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    kubernetes_uid VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    workload_type VARCHAR(50) DEFAULT 'Deployment',
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    labels JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workloads_name ON workloads(name);

-- 17. Bảng `services`: Dịch vụ K8s Service định tuyến mạng
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    namespace_id UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    kubernetes_uid VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50),
    selector JSONB DEFAULT '{}'::JSONB,
    ports JSONB DEFAULT '[]'::JSONB,
    cluster_ip INET,
    external_ip INET,
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Bảng `deployments`: Trạng thái bản sao và chiến lược triển khai K8s
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workload_id UUID NOT NULL REFERENCES workloads(id) ON DELETE CASCADE,
    desired_replicas INT DEFAULT 0 CHECK (desired_replicas >= 0),
    available_replicas INT DEFAULT 0 CHECK (available_replicas >= 0),
    ready_replicas INT DEFAULT 0 CHECK (ready_replicas >= 0),
    strategy VARCHAR(50),
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Bảng `pods`: Danh mục các Pods chi tiết đang chạy trong cụm
CREATE TABLE IF NOT EXISTS pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    namespace_id UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    workload_id UUID REFERENCES workloads(id) ON DELETE SET NULL,
    kubernetes_uid VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    phase VARCHAR(50),
    restart_count INT DEFAULT 0 CHECK (restart_count >= 0),
    image TEXT,
    labels JSONB DEFAULT '{}'::JSONB,
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pods_namespace ON pods(namespace_id);
CREATE INDEX IF NOT EXISTS idx_pods_workload ON pods(workload_id);

-- ====================================================================
-- PHẦN 7: KUBERNETES AGENT, TOKENS & TELEMETRY STREAM (6 BẢNG)
-- ====================================================================

-- 20. Bảng `agents`: Kubernetes Agent giám sát
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    agent_uid VARCHAR(255) UNIQUE NOT NULL,
    cluster_id VARCHAR(255),
    environment_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE',
    version VARCHAR(50) DEFAULT '1.0.0',
    installed_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_uid ON agents(agent_uid);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- 21. Bảng `agent_tokens`: Token xác thực kết nối WebSocket bảo mật
CREATE TABLE IF NOT EXISTS agent_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    token_prefix VARCHAR(50),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash ON agent_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent ON agent_tokens(agent_id);

-- 22. Bảng `agent_heartbeats`: Lịch sử nhịp tim kiểm tra tính khả dụng
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    agent_version VARCHAR(50) DEFAULT '1.0.0',
    latency_ms INT DEFAULT 0,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON agent_heartbeats(agent_id, reported_at DESC);

-- 23. Bảng `agent_metrics`: Dữ liệu đo đạc tài nguyên thời gian thực (CPU, RAM, Disk, Latency...)
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

-- 24. Bảng `logs`: Nhật ký vận hành từ Pods và Services
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    cluster_id VARCHAR(255),
    namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    service_id VARCHAR(255),
    pod_id UUID,
    trace_id VARCHAR(255),
    level VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100) DEFAULT 'k8s-agent',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_service_occurred ON logs(service_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- 25. Bảng `kubernetes_events`: Sự kiện cảnh báo từ Control Plane K8s
CREATE TABLE IF NOT EXISTS kubernetes_events (
    id BIGSERIAL PRIMARY KEY,
    cluster_id VARCHAR(255),
    namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
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
-- PHẦN 8: AI MODELS, DỰ ĐOÁN (GRU), SỰ CỐ & RCA (6 BẢNG)
-- ====================================================================

-- 26. Bảng `ai_models`: Đăng ký phiên bản mô hình AI (GRU / RCA)
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) DEFAULT 'GRU_RISK_CLASSIFICATION',
    framework VARCHAR(50) DEFAULT 'PyTorch',
    version VARCHAR(50) DEFAULT '1.0.0',
    description TEXT,
    training_dataset TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. Bảng `ai_predictions`: Kết quả dự đoán rủi ro bất thường từ mạng nơ-ron GRU
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

-- 28. Bảng `prediction_inputs`: Chi tiết chuỗi thời gian đầu vào phục vụ mô hình GRU
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

-- 29. Bảng `incidents`: Quản lý sự cố cần tự phục hồi
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);

-- 30. Bảng `rca_analyses`: Phân tích nguyên nhân gốc rễ (Root Cause Analysis)
CREATE TABLE IF NOT EXISTS rca_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    root_cause_type VARCHAR(100) NOT NULL,
    root_cause_description TEXT NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    analysis_method VARCHAR(100) DEFAULT 'AI_DETERMINISTIC_RULES',
    analysis_status VARCHAR(50) DEFAULT 'COMPLETED',
    analysis_result TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 31. Bảng `rca_evidences`: Bằng chứng củng cố kết luận nguyên nhân gốc
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
-- PHẦN 9: ĐỘNG CƠ TỰ PHỤC HỒI (SELF-HEALING ENGINE) (8 BẢNG)
-- ====================================================================

-- 32. Bảng `healing_action_types`: Danh mục các hành động tự khắc phục chuẩn
CREATE TABLE IF NOT EXISTS healing_action_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    target_type VARCHAR(50) DEFAULT 'POD',
    default_risk_level risk_level DEFAULT 'LOW',
    requires_approval_by_default BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 33. Bảng `ai_recommendations`: Các khuyến nghị hành động chữa lành từ AI
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

-- 34. Bảng `healing_policies`: Chính sách tự chữa lành và ngưỡng kiểm soát
CREATE TABLE IF NOT EXISTS healing_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    risk_type VARCHAR(50),
    execution_mode execution_mode DEFAULT 'MANUAL',
    risk_level risk_level DEFAULT 'MEDIUM',
    confidence_threshold NUMERIC(5,4) CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
    cooldown_seconds INT DEFAULT 300 CHECK (cooldown_seconds >= 0),
    max_retries INT DEFAULT 1 CHECK (max_retries >= 0),
    requires_approval BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 35. Bảng `policy_actions`: Liên kết giữa chính sách và hành động cụ thể
CREATE TABLE IF NOT EXISTS policy_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES healing_policies(id) ON DELETE CASCADE,
    action_type_id UUID NOT NULL REFERENCES healing_action_types(id) ON DELETE RESTRICT,
    priority INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    configuration JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 36. Bảng `healing_actions`: Phiên thực thi hành động tự chữa lành cụ thể
CREATE TABLE IF NOT EXISTS healing_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES ai_recommendations(id) ON DELETE SET NULL,
    policy_id UUID REFERENCES healing_policies(id) ON DELETE SET NULL,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    action_type_id UUID NOT NULL REFERENCES healing_action_types(id) ON DELETE RESTRICT,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    target_name VARCHAR(255),
    risk_level risk_level NOT NULL,
    execution_mode execution_mode NOT NULL,
    approval_status approval_status DEFAULT 'PENDING',
    execution_status execution_status DEFAULT 'PENDING',
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_actions_status ON healing_actions(execution_status);

-- 37. Bảng `approvals`: Quy trình phê duyệt hành động có rủi ro từ Admin/SME Owner
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    healing_action_id UUID NOT NULL REFERENCES healing_actions(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status approval_status DEFAULT 'PENDING',
    reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- 38. Bảng `execution_attempts`: Lịch sử các lần thử thực thi lệnh tự chữa lành
CREATE TABLE IF NOT EXISTS execution_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    healing_action_id UUID NOT NULL REFERENCES healing_actions(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL CHECK (attempt_number > 0),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    command_type VARCHAR(100) NOT NULL,
    request_payload JSONB DEFAULT '{}'::JSONB,
    response_payload JSONB DEFAULT '{}'::JSONB,
    status execution_status DEFAULT 'PENDING',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT
);

-- 39. Bảng `recovery_verifications`: Xác minh và đánh giá mức độ thành công sau phục hồi
CREATE TABLE IF NOT EXISTS recovery_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    healing_action_id UUID NOT NULL REFERENCES healing_actions(id) ON DELETE CASCADE,
    verification_type VARCHAR(100) NOT NULL,
    status_before JSONB DEFAULT '{}'::JSONB,
    status_after JSONB DEFAULT '{}'::JSONB,
    verification_result BOOLEAN,
    verification_details JSONB DEFAULT '{}'::JSONB,
    verified_at TIMESTAMPTZ,
    duration_ms BIGINT
);

-- ====================================================================
-- PHẦN 10: ĐỒNG BỘ CỘT NÂNG CAO CHO CÁC BẢNG ĐÃ TỒN TẠI (NẾU CÓ)
-- ====================================================================
ALTER TABLE workloads
    ADD COLUMN IF NOT EXISTS namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kubernetes_uid VARCHAR(255),
    ADD COLUMN IF NOT EXISTS workload_type VARCHAR(50) DEFAULT 'Deployment',
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE clusters
    ADD COLUMN IF NOT EXISTS cluster_uid VARCHAR(255),
    ADD COLUMN IF NOT EXISTS endpoint TEXT,
    ADD COLUMN IF NOT EXISTS kubernetes_version VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'CONNECTED',
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE environments
    ADD COLUMN IF NOT EXISTS code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS environment_type environment_type DEFAULT 'PRODUCTION',
    ADD COLUMN IF NOT EXISTS status environment_status DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE healing_action_types
    ADD COLUMN IF NOT EXISTS code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'POD',
    ADD COLUMN IF NOT EXISTS default_risk_level risk_level DEFAULT 'LOW',
    ADD COLUMN IF NOT EXISTS requires_approval_by_default BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ai_models
    ADD COLUMN IF NOT EXISTS model_type VARCHAR(100) DEFAULT 'GRU_RISK_CLASSIFICATION',
    ADD COLUMN IF NOT EXISTS framework VARCHAR(50) DEFAULT 'PyTorch',
    ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS training_dataset TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ;

ALTER TABLE agent_heartbeats
    ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0;

ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pod_id UUID,
    ADD COLUMN IF NOT EXISTS trace_id VARCHAR(255);

ALTER TABLE kubernetes_events
    ADD COLUMN IF NOT EXISTS namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL;

-- ====================================================================
-- PHẦN 11: SEED DATA MẶC ĐỊNH & KHỞI TẠO NỀN TẢNG
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
INSERT INTO environments (id, organization_id, name, env_type, code)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Production Kubernetes',
    'PRODUCTION',
    'prod-k8s'
)
ON CONFLICT (id) DO NOTHING;

-- 8. Cụm K8s mặc định
INSERT INTO clusters (id, environment_id, name, provider, cluster_uid)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'cluster-k8s-sme-01',
    'MINIKUBE',
    'minikube-local-uid'
)
ON CONFLICT (id) DO NOTHING;

-- 9. Namespace mặc định
INSERT INTO namespaces (id, cluster_id, name, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'default',
    'Active'
)
ON CONFLICT (id) DO NOTHING;

-- 10. Workload dịch vụ mẫu
INSERT INTO workloads (id, name, cluster_id, namespace_id, workload_type)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'order-service',
    'cluster-k8s-sme-01',
    'b0000000-0000-0000-0000-000000000001',
    'Deployment'
)
ON CONFLICT (id) DO NOTHING;

-- 11. Đầy đủ 7 hành động tự phục hồi chuẩn (Healing Action Types)
INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'RESTART_POD', 'Restart Pod', 'Khởi động lại Pod bị lỗi hoặc treo tiến trình', 'POD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000002', 'SCALE_REPLICAS', 'Scale Replicas', 'Tăng hoặc giảm số lượng bản sao Pod để điều tiết tải', 'WORKLOAD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000003', 'ROLLBACK_DEPLOYMENT', 'Rollback Deployment', 'Quay lại phiên bản deployment ổn định trước đó', 'WORKLOAD', 'HIGH', true, true),
    ('d0000000-0000-0000-0000-000000000004', 'CLEANUP_TEMP_FILES', 'Cleanup Temporary Files', 'Dọn dẹp tệp tin tạm và giải phóng bộ nhớ lưu trữ', 'POD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000005', 'BLOCK_IP_TEMP', 'Temporary IP Block', 'Tạm thời chặn nguồn lưu lượng bất thường gây quá tải', 'NETWORK', 'HIGH', true, true),
    ('d0000000-0000-0000-0000-000000000006', 'ADJUST_RESOURCE_LIMITS', 'Adjust Resource Limits', 'Điều chỉnh hạn mức CPU và RAM của container', 'WORKLOAD', 'MEDIUM', false, true),
    ('d0000000-0000-0000-0000-000000000007', 'DRAIN_NODE', 'Drain Node', 'Di tản toàn bộ Pod khỏi Node gặp sự cố phần cứng', 'NODE', 'CRITICAL', true, true)
ON CONFLICT (name) DO UPDATE 
SET code = EXCLUDED.code, description = EXCLUDED.description, default_risk_level = EXCLUDED.default_risk_level;

-- 12. AI Model GRU phân loại rủi ro
INSERT INTO ai_models (id, name, status, framework, version)
VALUES ('00000000-0000-0000-0000-000000000001', 'GRU_RISK_CLASSIFICATION', 'ACTIVE', 'PyTorch', '1.0.0')
ON CONFLICT (id) DO NOTHING;

-- 13. K8s Agent mẫu cho doanh nghiệp
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

-- 14. Token xác thực Agent
INSERT INTO agent_tokens (id, agent_id, token_hash, expires_at, created_at)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '7119ac14ceb8f5b908262a253c96011341843ca57f025e482cade4f859e05afc', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cpt_sec_demo_token_2026_change_me', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sh_sec_demo_token_change_me_in_production', NOW() + INTERVAL '365 days', NOW()),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '879fb60445897373ff2ef309326af711eebb639d088f2e7a054a06a705c4840c', NOW() + INTERVAL '365 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- KẾT THÚC KHỞI TẠO TOÀN BỘ 39 BẢNG CƠ SỞ DỮ LIỆU CHUẨN
-- ====================================================================
