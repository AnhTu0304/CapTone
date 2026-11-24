-- ====================================================================
-- Idempotent Development & Demo Seed Data (Separated from 00_init_full_database.sql)
-- Governance Rule (SD-01-03):
--   - Uses ON CONFLICT ... DO NOTHING for all user accounts and organizations.
--   - NEVER overwrites existing user or administrator password_hash/status.
--   - Executed ONLY when explicitly requested via `--seed` in non-production/init setup.
-- ====================================================================

-- 1. Tài khoản Quản trị viên Dev/Demo mặc định (chỉ chèn nếu chưa tồn tại)
INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
VALUES (
    'd3a26d55-0b9f-48e7-a328-846badf96cd7',
    'phamthaisang1710@gmail.com',
    '$2b$10$APWkvgW0lABeeSJJR0u8ru4uj8oKZymvphd5b3TM4kGbP3d6vV8Ey',
    'Phạm Thái Sang',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
VALUES (
    'superadmin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Tối Cao',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
VALUES (
    'admin@selfheal.com',
    crypt('AdminPassword123@', gen_salt('bf', 10)),
    'Quản Trị Viên Vận Hành (Admin)',
    'ACTIVE',
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Gán quyền SUPER_ADMIN / ADMIN nếu chưa có
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

-- 2. Tổ chức Doanh nghiệp mẫu mặc định
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

INSERT INTO organization_profiles (organization_id, description, email, timezone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Doanh nghiệp Bán lẻ SME Retail Enterprise',
    'contact@smeretail.com',
    'Asia/Ho_Chi_Minh'
)
ON CONFLICT (organization_id) DO NOTHING;

DO $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'phamthaisang1710@gmail.com' LIMIT 1;
    SELECT id INTO v_role_id FROM organization_roles WHERE code = 'SME_OWNER' LIMIT 1;

    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
        VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, v_role_id, 'ACTIVE', NOW())
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
END $$;

INSERT INTO organization_alert_settings (organization_id, critical_email_enabled, notify_on_no_action, notify_on_healing_failed)
VALUES ('00000000-0000-0000-0000-000000000001', TRUE, TRUE, TRUE)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO environments (id, organization_id, name, environment_type, code)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Production Kubernetes',
    'PRODUCTION',
    'prod-k8s'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clusters (id, environment_id, name, provider, cluster_uid)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'cluster-k8s-sme-01',
    'MINIKUBE',
    'minikube-local-uid'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO namespaces (id, cluster_id, name, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'default',
    'Active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workloads (id, name, cluster_id, namespace_id, workload_type)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'order-service',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Deployment'
)
ON CONFLICT (id) DO NOTHING;

-- 3. K8s Agent mẫu cho doanh nghiệp (chỉ chèn mới nếu chưa có)
INSERT INTO agents (id, name, agent_uid, cluster_id, environment_id, status, last_seen_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Production K8s SME Agent',
    'captone-agent-default',
    'c0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'ONLINE',
    NOW()
)
ON CONFLICT (agent_uid) DO NOTHING;

-- 4. Demo System Broadcasts
INSERT INTO system_broadcasts (broadcast_code, title, content, priority, audience, status, views_count, created_at)
VALUES
(
    'BC-2026-09',
    'Thông báo cập nhật thuật toán AI Model v2.4.1 (ONNX Runtime)',
    'Hệ thống đã triển khai phiên bản mô hình phát hiện dị thường mới với độ trễ suy luận chỉ 1.2ms và giảm 82% tỷ lệ báo động nhầm.',
    'INFO',
    'Tất cả người dùng',
    'Đang hiển thị',
    1240,
    NOW() - INTERVAL '3 days'
),
(
    'BC-2026-08',
    'Bảo trì hạ tầng cơ sở dữ liệu định kỳ Quý 4',
    'Hệ thống sẽ tiến hành bảo trì tối ưu hóa cơ sở dữ liệu PostgreSQL trong 15 phút vào 02:00 Chủ Nhật ngày 25/10/2026.',
    'WARNING',
    'Chủ Doanh nghiệp & DevOps',
    'Đã lên lịch',
    890,
    NOW() - INTERVAL '5 days'
),
(
    'BC-2026-07',
    'Cảnh báo an ninh: Đã kích hoạt cơ chế mã hóa kiểm toán SHA-256',
    'Toàn bộ thao tác phân quyền và tự phục hồi từ nay được bảo vệ bằng chữ ký số bất khả xâm phạm.',
    'INFO',
    'Tất cả người dùng',
    'Đã kết thúc',
    2450,
    NOW() - INTERVAL '14 days'
)
ON CONFLICT (broadcast_code) DO NOTHING;
