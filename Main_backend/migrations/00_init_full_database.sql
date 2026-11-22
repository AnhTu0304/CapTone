-- ====================================================================
-- SelfHeal Platform - MASTER FULL DATABASE MIGRATION (44 TABLES)
-- File: 00_init_full_database.sql
-- Mô tả: File khởi tạo toàn bộ CSDL 44 bảng chuẩn Enterprise:
--       Tiện ích pgcrypto, 12 kiểu ENUM, 44 Bảng vật lý chuẩn Enterprise,
--       Sequences, Ràng buộc, Chỉ mục hiệu năng cao (Composite Indexes),
--       6 Stored Procedures AI/GRU/RCA và Dữ liệu mẫu (Seed Data) đầy đủ.
-- Phiên bản: 3.0 (Complete 44-Table Enterprise Architecture)
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

    -- 7. Trạng thái thực thi tự phục hồi
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_status') THEN
        CREATE TYPE execution_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED');
    END IF;

    -- 8. Trạng thái phê duyệt hành động phục hồi
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
    END IF;

    -- 9. Mức độ rủi ro của hành động tự phục hồi
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
        CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;

    -- 10. Chế độ thực thi tự phục hồi
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_mode') THEN
        CREATE TYPE execution_mode AS ENUM ('AUTOMATIC', 'MANUAL', 'SEMI_AUTOMATIC');
    END IF;

    -- 11. Loại môi trường
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_type') THEN
        CREATE TYPE environment_type AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION', 'DR');
    END IF;

    -- 12. Trạng thái môi trường
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_status') THEN
        CREATE TYPE environment_status AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
    END IF;
END $$;

-- ====================================================================
-- PHẦN 3: BẢNG QUẢN LÝ NGƯỜI DÙNG, BẢO MẬT & XÁC THỰC (6 BẢNG)
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

-- 4. Bảng `user_two_factor`: Xác thực bảo mật hai lớp TOTP (2FA)
CREATE TABLE IF NOT EXISTS user_two_factor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret_key TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSONB DEFAULT '[]'::jsonb,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_two_factor_user_id ON user_two_factor(user_id);

-- 5. Bảng `system_roles`: Vai trò quản trị cấp nền tảng
CREATE TABLE IF NOT EXISTS system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Bảng `user_system_roles`: Phân quyền vai trò hệ thống cho người dùng
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
-- PHẦN 4: TỔ CHỨC, HỒ SƠ, VAI TRÒ, THÀNH VIÊN & LỜI MỜI (6 BẢNG)
-- ====================================================================

-- 7. Bảng `organization_roles`: Vai trò cấp tổ chức
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE roles RENAME TO organization_roles;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'roles_pkey') THEN
            ALTER INDEX roles_pkey RENAME TO organization_roles_pkey;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'roles_code_key') THEN
            ALTER INDEX roles_code_key RENAME TO organization_roles_code_key;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS organization_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bảng `organizations`: Danh mục các doanh nghiệp / tổ chức
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

-- 9. Bảng `organization_profiles`: Hồ sơ thông tin chi tiết của tổ chức
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

-- 10. Bảng `organization_members`: Thành viên và phân quyền trong tổ chức
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE RESTRICT,
    status member_status NOT NULL DEFAULT 'INVITED',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- 11. Bảng `organization_invitations`: Quản lý vòng đời lời mời tham gia tổ chức
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE RESTRICT,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_org_invitations_token_hash ON organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);

-- 12. Bảng `organization_alert_settings`: Cấu hình cảnh báo khẩn cấp cho từng tổ chức
CREATE TABLE IF NOT EXISTS organization_alert_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    critical_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_no_action BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_healing_failed BOOLEAN NOT NULL DEFAULT TRUE,
    extra_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
    cooldown_minutes INTEGER NOT NULL DEFAULT 15 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
    slack_webhook_url TEXT,
    slack_channel VARCHAR(100),
    pagerduty_key TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- PHẦN 5: NHẬT KÝ KIỂM TOÁN (AUDIT), THÔNG BÁO & PHÁT SÓNG (3 BẢNG)
-- ====================================================================

-- 13. Bảng `audit_logs`: Nhật ký kiểm toán bảo mật và tác vụ quản trị
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
    reason_code VARCHAR(100),
    request_id VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- 14. Bảng `notifications`: Quản lý thông báo người dùng và cảnh báo sự cố
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
CREATE INDEX IF NOT EXISTS idx_notifications_incident ON notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 15. Bảng `system_broadcasts`: Bảng lưu trữ các thông báo toàn mạng do Admin phát sóng
CREATE TABLE IF NOT EXISTS system_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'INFO',
    audience VARCHAR(50) NOT NULL DEFAULT 'ALL',
    status VARCHAR(50) NOT NULL DEFAULT 'Đang hiển thị',
    show_sticky_banner BOOLEAN DEFAULT TRUE,
    views_count INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_broadcasts_created ON system_broadcasts(created_at DESC);

-- ====================================================================
-- PHẦN 6: HẠ TẦNG KUBERNETES & WORKLOADS (8 BẢNG)
-- ====================================================================

-- 16. Bảng `environments`: Các môi trường vận hành (Production, Staging...)
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    environment_type environment_type DEFAULT 'PRODUCTION',
    status environment_status DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_environments_org ON environments(organization_id);

-- 17. Bảng `clusters`: Cụm Kubernetes quản lý
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

-- 18. Bảng `nodes`: Các node máy chủ vật lý / ảo hóa trong cụm K8s
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
    conditions JSONB DEFAULT '{}'::JSONB,
    allocatable JSONB DEFAULT '{}'::JSONB,
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_cluster ON nodes(cluster_id);

-- 19. Bảng `namespaces`: Không gian tên phân tách logic trong cụm K8s
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

-- 20. Bảng `workloads`: Dịch vụ, Microservices hoặc Deployments cấp cao
CREATE TABLE IF NOT EXISTS workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cluster_id VARCHAR(255),
    namespace_id UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    kubernetes_uid VARCHAR(255),
    workload_type VARCHAR(50) DEFAULT 'Deployment',
    status VARCHAR(30) DEFAULT 'UNKNOWN',
    labels JSONB DEFAULT '{}'::JSONB,
    desired_replicas INT,
    ready_replicas INT,
    available_replicas INT,
    updated_replicas INT,
    unavailable_replicas INT,
    generation BIGINT,
    observed_generation BIGINT,
    conditions JSONB DEFAULT '{}'::JSONB,
    rollout_status VARCHAR(50),
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workloads_name ON workloads(name);

-- 21. Bảng `services`: Dịch vụ K8s Service định tuyến mạng
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

-- 22. Bảng `deployments`: Trạng thái bản sao và chiến lược triển khai K8s
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

-- 23. Bảng `pods`: Danh mục các Pods chi tiết đang chạy trong cụm
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
    containers JSONB DEFAULT '[]'::JSONB,
    observed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pods_namespace ON pods(namespace_id);
CREATE INDEX IF NOT EXISTS idx_pods_workload ON pods(workload_id);

-- ====================================================================
-- PHẦN 7: KUBERNETES AGENT, TOKENS & TELEMETRY STREAM (7 BẢNG)
-- ====================================================================

-- 24. Bảng `agents`: Kubernetes Agent giám sát
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

-- 25. Bảng `agent_tokens`: Token xác thực kết nối WebSocket bảo mật
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

-- 26. Bảng `agent_heartbeats`: Lịch sử nhịp tim kiểm tra tính khả dụng
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

-- 27. Bảng `agent_metrics`: Dữ liệu đo đạc tài nguyên thời gian thực (CPU, RAM, Disk, Latency...)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
    batch_id VARCHAR(100),
    sample_id VARCHAR(100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_dedup
    ON agent_metrics(agent_id, service_id, pod_id, collected_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_sample_id
    ON agent_metrics(sample_id)
    WHERE sample_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_collected ON agent_metrics(service_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_collected_at ON agent_metrics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_time ON agent_metrics(organization_id, collected_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_service_time ON agent_metrics(organization_id, service_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_pod_time ON agent_metrics(service_id, pod_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_cluster_time ON agent_metrics(cluster_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_batch_id ON agent_metrics(batch_id) WHERE batch_id IS NOT NULL;

-- 28. Bảng `node_metrics`: Dữ liệu tài nguyên cấp Host/Node (CPU, RAM, Disk, Network I/O)
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

-- 29. Bảng `logs`: Nhật ký vận hành từ Pods và Services
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

-- 30. Bảng `kubernetes_events`: Sự kiện cảnh báo từ Control Plane K8s
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_uid VARCHAR(255),
    dedup_hash VARCHAR(64),
    reporting_controller VARCHAR(100),
    action VARCHAR(100),
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_k8s_events_cluster_dedup
    ON kubernetes_events(cluster_id, dedup_hash);

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_event_uid
    ON kubernetes_events(cluster_id, event_uid)
    WHERE event_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_type_time
    ON kubernetes_events(cluster_id, event_type, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_ns_time
    ON kubernetes_events(cluster_id, namespace_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_k8s_events_cluster_last_seen
    ON kubernetes_events(cluster_id, last_seen_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_k8s_events_resource ON kubernetes_events(resource_uid, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_k8s_events_reason ON kubernetes_events(reason);

-- ====================================================================
-- PHẦN 8: AI MODELS, DỰ ĐOÁN (GRU), SỰ CỐ & RCA (6 BẢNG)
-- ====================================================================

-- 31. Bảng `ai_models`: Đăng ký phiên bản mô hình AI (GRU / RCA)
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

-- 32. Bảng `ai_predictions`: Kết quả dự đoán rủi ro bất thường từ mạng nơ-ron GRU
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    risk_outputs JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_model ON ai_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_status ON ai_predictions(status);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_predicted_at ON ai_predictions(predicted_at DESC);

-- 33. Bảng `prediction_inputs`: Chi tiết chuỗi thời gian đầu vào phục vụ mô hình GRU
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

-- 34. Bảng `incidents`: Quản lý sự cố cần tự phục hồi
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
    title TEXT NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_name VARCHAR(255),
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_cluster_detected ON incidents(cluster_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_dedup_lookup ON incidents (environment_id, incident_type, status, target_name, last_occurred_at DESC);

-- 35. Bảng `rca_analyses`: Phân tích nguyên nhân gốc rễ (Root Cause Analysis)
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

-- 36. Bảng `rca_evidences`: Bằng chứng củng cố kết luận nguyên nhân gốc
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

-- 37. Bảng `healing_action_types`: Danh mục các hành động tự khắc phục chuẩn
CREATE TABLE IF NOT EXISTS healing_action_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    target_type VARCHAR(50) DEFAULT 'POD',
    default_risk_level risk_level DEFAULT 'LOW',
    requires_approval_by_default BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 38. Bảng `ai_recommendations`: Các khuyến nghị hành động chữa lành từ AI
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

-- 39. Bảng `healing_policies`: Chính sách tự chữa lành và ngưỡng kiểm soát
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

-- 40. Bảng `policy_actions`: Liên kết giữa chính sách và hành động cụ thể
CREATE TABLE IF NOT EXISTS policy_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES healing_policies(id) ON DELETE CASCADE,
    action_type_id UUID NOT NULL REFERENCES healing_action_types(id) ON DELETE RESTRICT,
    priority INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    configuration JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 41. Bảng `healing_actions`: Phiên thực thi hành động tự chữa lành cụ thể
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

-- 42. Bảng `approvals`: Quy trình phê duyệt hành động có rủi ro từ Admin/SME Owner
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

-- 43. Bảng `execution_attempts`: Lịch sử các lần thử thực thi lệnh tự chữa lành
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

-- 44. Bảng `recovery_verifications`: Xác minh và đánh giá mức độ thành công sau phục hồi
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

-- =====================================================================
-- PHẦN 10: CHỈ MỤC COMPOSITE & STORED PROCEDURES AI/GRU/RCA
-- =====================================================================

-- Dọn dẹp các view tương thích cũ (nếu có từ bản nâng cấp trước)
DROP VIEW IF EXISTS roles;
DROP VIEW IF EXISTS roles_organizations;

-- 2. Chỉ mục Composite B-Tree tăng tốc AI & Self-Healing
CREATE INDEX IF NOT EXISTS idx_pred_inputs_pred_collected_metric
  ON public.prediction_inputs (prediction_id, collected_at ASC, metric_name ASC);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_cluster_predicted
  ON public.ai_predictions (cluster_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_workload_predicted
  ON public.ai_predictions (workload_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_env_type_predicted
  ON public.ai_predictions (environment_id, prediction_type, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recs_incident_priority
  ON public.ai_recommendations (incident_id, priority ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recs_status_rec_created
  ON public.ai_recommendations (recommendation, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recs_rca_prediction
  ON public.ai_recommendations (rca_analysis_id, prediction_id);

CREATE INDEX IF NOT EXISTS idx_healing_actions_status_created
  ON public.healing_actions (execution_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_healing_actions_incident_created
  ON public.healing_actions (incident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_org_cluster_created
  ON public.incidents (organization_id, cluster_id, created_at DESC);

-- 3. Stored Procedures / Functions AI/GRU/RCA

-- (1) sp_get_gru_predictions_history
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

-- (2) sp_get_prediction_inputs_raw
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

-- (3) sp_get_gru_12step_sequence
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

-- (4) sp_get_ai_prediction_stats
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

-- (5) sp_get_ai_recommendations_paginated
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
  incident_title TEXT,
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
      i.title::TEXT AS incident_title,
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

-- (6) sp_cleanup_old_prediction_inputs
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
INSERT INTO organization_roles (code, name, description, scope) VALUES
    ('ADMIN', 'Platform Admin', 'Quản trị toàn bộ nền tảng', 'PLATFORM'),
    ('SME_OWNER', 'SME Owner', 'Quản lý tổ chức và kiểm soát self-healing', 'ORGANIZATION'),
    ('DEVOPS', 'DevOps', 'Quản lý hạ tầng, agent và vận hành kỹ thuật', 'ORGANIZATION'),
    ('VIEWER', 'Viewer', 'Chỉ xem dữ liệu được cấp quyền', 'ORGANIZATION')
ON CONFLICT (code) DO NOTHING;

-- 3. Đầy đủ 7 hành động tự phục hồi chuẩn (Healing Action Types - Catalog tham chiếu)
INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'RESTART_POD', 'Restart Pod', 'Khởi động lại Pod bị lỗi hoặc treo tiến trình', 'POD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000002', 'SCALE_REPLICAS', 'Scale Replicas', 'Tăng hoặc giảm số lượng bản sao Pod để điều tiết tải', 'WORKLOAD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000003', 'ROLLBACK_DEPLOYMENT', 'Rollback Deployment', 'Quay lại phiên bản deployment ổn định trước đó', 'WORKLOAD', 'HIGH', true, true),
    ('d0000000-0000-0000-0000-000000000004', 'CLEANUP_TEMP_FILES', 'Cleanup Temporary Files', 'Dọn dẹp tệp tin tạm và giải phóng bộ nhớ lưu trữ', 'POD', 'LOW', false, true),
    ('d0000000-0000-0000-0000-000000000005', 'BLOCK_IP_TEMP', 'Temporary IP Block', 'Tạm thời chặn nguồn lưu lượng bất thường gây quá tải', 'NETWORK', 'HIGH', true, true),
    ('d0000000-0000-0000-0000-000000000006', 'ADJUST_RESOURCE_LIMITS', 'Adjust Resource Limits', 'Điều chỉnh hạn mức CPU và RAM của container', 'WORKLOAD', 'MEDIUM', false, true),
    ('d0000000-0000-0000-0000-000000000007', 'DRAIN_NODE', 'Drain Node', 'Di tản toàn bộ Pod khỏi Node gặp sự cố phần cứng', 'NODE', 'CRITICAL', true, true)
ON CONFLICT (code) DO NOTHING;

-- 4. AI Model GRU phân loại rủi ro mặc định (Catalog tham chiếu)
INSERT INTO ai_models (id, name, model_type, status, framework, version)
VALUES ('00000000-0000-0000-0000-000000000001', 'GRU_RISK_CLASSIFICATION', 'GRU_RISK_CLASSIFICATION', 'ACTIVE', 'PyTorch', '1.0.0')
ON CONFLICT (id) DO NOTHING;

-- Ghi chú (SD-01-03): Toàn bộ tài khoản quản trị mẫu, tổ chức mẫu và dữ liệu demo đã được tách ra thư mục `Main_backend/seeds/`.
-- ====================================================================
-- KẾT THÚC KHỞI TẠO TOÀN BỘ 44 BẢNG CƠ SỞ DỮ LIỆU ENTERPRISE CHUẨN
-- ====================================================================
