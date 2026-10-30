import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { pool } from '../config/database';

async function seedRichData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get organization and environment
    const orgRes = await client.query(
      "SELECT id, name FROM organizations WHERE name = 'Cloud DevOps Engineering Hub' LIMIT 1"
    );
    if (orgRes.rows.length === 0) {
      console.error('Organization not found');
      return;
    }
    const orgId = orgRes.rows[0].id;

    const envRes = await client.query(
      "SELECT id FROM environments WHERE organization_id = $1 LIMIT 1",
      [orgId]
    );
    const envId = envRes.rows[0].id;

    // Target the active cluster: cmu-tpm3-v1
    const clusterRes = await client.query(
      "SELECT id FROM clusters WHERE environment_id = $1 AND name = 'cmu-tpm3-v1' LIMIT 1",
      [envId]
    );
    const clusterId = clusterRes.rows.length > 0 ? clusterRes.rows[0].id : (await client.query("SELECT id FROM clusters WHERE environment_id = $1 LIMIT 1", [envId])).rows[0].id;

    console.log(`Seeding rich sample data for Org: ${orgId}, Env: ${envId}, Cluster: ${clusterId}`);

    // 2. Action Types Map
    const actionTypesRes = await client.query("SELECT id, code FROM healing_action_types");
    const actionTypeMap = new Map<string, string>();
    actionTypesRes.rows.forEach((r: any) => actionTypeMap.set(r.code, r.id));

    // 3. Clear existing demo incidents for this cluster to avoid duplicates
    await client.query(
      "DELETE FROM incidents WHERE cluster_id = $1",
      [clusterId]
    );

    // 4. Comprehensive list of realistic incidents across 6 months / 4 quarters
    const richIncidents = [
      // --- Gần đây (Tháng hiện tại / Quý 4) ---
      {
        service: 'order-processor',
        incident_type: 'CrashLoopBackOff',
        title: 'CrashLoopBackOff on order-processor-v2',
        description: 'Tỷ lệ lỗi khởi động tăng đột biến sau khi cập nhật cấu hình',
        severity: 'HIGH',
        action_code: 'ROLLBACK_DEPLOYMENT',
        daysAgo: 2,
        durationSeconds: 2.1,
      },
      {
        service: 'payment-service',
        incident_type: 'OOMKilled',
        title: 'OOMKilled on payment-service-pod-01',
        description: 'Bộ nhớ container vượt ngưỡng 1024MB trong đợt thanh toán cao điểm',
        severity: 'CRITICAL',
        action_code: 'RESTART_POD',
        daysAgo: 5,
        durationSeconds: 1.4,
      },
      {
        service: 'api-gateway',
        incident_type: 'HighTrafficSpike',
        title: 'CPU Usage exceeded 88% on api-gateway',
        description: 'Lưu lượng truy cập cổng API vượt ngưỡng cảnh báo 85%',
        severity: 'MEDIUM',
        action_code: 'SCALE_REPLICAS',
        daysAgo: 8,
        durationSeconds: 1.8,
      },
      {
        service: 'auth-service',
        incident_type: 'ProbeFailure',
        title: 'Readiness probe failed on auth-service-worker-2',
        description: 'Readiness check timeout liên tiếp 3 lần do tắc nghẽn connection pool',
        severity: 'LOW',
        action_code: 'RESTART_POD',
        daysAgo: 12,
        durationSeconds: 1.3,
      },
      {
        service: 'notification-service',
        incident_type: 'DiskPressure',
        title: 'Disk space warning on notification-service pod',
        description: 'Dung lượng log tạm thời spool chiếm hơn 85% phân vùng cục bộ',
        severity: 'LOW',
        action_code: 'CLEANUP_TEMPORARY_FILES',
        daysAgo: 18,
        durationSeconds: 1.9,
      },
      {
        service: 'payment-service',
        incident_type: 'CrashLoopBackOff',
        title: 'Worker crash loop on payment-service-sub',
        description: 'Tiến trình kết nối cổng thanh toán thứ cấp bị sập liên tục',
        severity: 'HIGH',
        action_code: 'REPLACE_POD',
        daysAgo: 24,
        durationSeconds: 1.6,
      },

      // --- 1-2 tháng trước (Quý 3) ---
      {
        service: 'order-processor',
        incident_type: 'OOMKilled',
        title: 'OOMKilled on order-processor-queue',
        description: 'Hàng đợi đơn hàng tồn đọng làm tràn heap size Node.js',
        severity: 'CRITICAL',
        action_code: 'RESTART_POD',
        daysAgo: 35,
        durationSeconds: 1.5,
      },
      {
        service: 'api-gateway',
        incident_type: 'HighTrafficSpike',
        title: 'Network ingress saturation on api-gateway',
        description: 'Lưu lượng mạng ingress đạt ngưỡng 90% băng thông cho phép',
        severity: 'MEDIUM',
        action_code: 'SCALE_REPLICAS',
        daysAgo: 48,
        durationSeconds: 2.0,
      },
      {
        service: 'auth-service',
        incident_type: 'ProbeFailure',
        title: 'Liveness probe timeout on auth-service-core',
        description: 'Thread pool bị nghẽn dẫn đến phản hồi liveness probe chậm quá 5s',
        severity: 'LOW',
        action_code: 'RESTART_POD',
        daysAgo: 58,
        durationSeconds: 1.2,
      },
      {
        service: 'notification-service',
        incident_type: 'DiskPressure',
        title: 'Cache volume warning on notification-service',
        description: 'Dung lượng bộ nhớ đệm tin nhắn vượt ngưỡng 80%',
        severity: 'LOW',
        action_code: 'CLEANUP_TEMPORARY_FILES',
        daysAgo: 68,
        durationSeconds: 1.7,
      },
      {
        service: 'payment-service',
        incident_type: 'HighTrafficSpike',
        title: 'Connection surge on payment-service',
        description: 'Tải kết nối database giao dịch vượt đỉnh 92%',
        severity: 'MEDIUM',
        action_code: 'SCALE_REPLICAS',
        daysAgo: 78,
        durationSeconds: 1.8,
      },

      // --- 3-4 tháng trước (Quý 2) ---
      {
        service: 'order-processor',
        incident_type: 'CrashLoopBackOff',
        title: 'CrashLoopBackOff on order-batch-runner',
        description: 'Lỗi parse payload không đồng bộ khiến tiến trình batch sập',
        severity: 'HIGH',
        action_code: 'ROLLBACK_DEPLOYMENT',
        daysAgo: 95,
        durationSeconds: 2.4,
      },
      {
        service: 'payment-service',
        incident_type: 'OOMKilled',
        title: 'OOMKilled on payment-crypto-signer',
        description: 'Rò rỉ bộ nhớ trong module giải mã khóa chứng thư số',
        severity: 'CRITICAL',
        action_code: 'RESTART_POD',
        daysAgo: 105,
        durationSeconds: 1.3,
      },
      {
        service: 'api-gateway',
        incident_type: 'ProbeFailure',
        title: 'Health check probe error on api-gateway-node-1',
        description: 'Cụm Ingress trả mã HTTP 503 liên tiếp trong 30 giây',
        severity: 'MEDIUM',
        action_code: 'RESTART_POD',
        daysAgo: 118,
        durationSeconds: 1.5,
      },
      {
        service: 'auth-service',
        incident_type: 'HighTrafficSpike',
        title: 'SSO Login traffic spike on auth-service',
        description: 'Lượng đăng nhập buổi sáng tăng gấp 4 lần mức bình thường',
        severity: 'MEDIUM',
        action_code: 'SCALE_REPLICAS',
        daysAgo: 128,
        durationSeconds: 1.7,
      },
      {
        service: 'order-processor',
        incident_type: 'DiskPressure',
        title: 'Spool volume near full on order-processor',
        description: 'Log tạm thời file xuất đơn hàng chưa được nén giải phóng',
        severity: 'LOW',
        action_code: 'CLEANUP_TEMPORARY_FILES',
        daysAgo: 138,
        durationSeconds: 1.8,
      },

      // --- 5-6 tháng trước (Quý 1) ---
      {
        service: 'payment-service',
        incident_type: 'CrashLoopBackOff',
        title: 'CrashLoopBackOff on payment-gateway-adapter',
        description: 'Adapter kết nối ngân hàng bị ngắt kết nối TLS liên tục',
        severity: 'HIGH',
        action_code: 'REPLACE_POD',
        daysAgo: 152,
        durationSeconds: 1.9,
      },
      {
        service: 'api-gateway',
        incident_type: 'OOMKilled',
        title: 'OOMKilled on api-gateway-rate-limiter',
        description: 'Bảng băm lưu token rate limit phình to vượt quá 512MB',
        severity: 'CRITICAL',
        action_code: 'RESTART_POD',
        daysAgo: 160,
        durationSeconds: 1.4,
      },
      {
        service: 'order-processor',
        incident_type: 'HighTrafficSpike',
        title: 'Flash sale order burst on order-processor',
        description: 'Chiến dịch khuyến mãi giờ vàng làm lượng đơn đổ về vượt 1500 req/s',
        severity: 'HIGH',
        action_code: 'SCALE_REPLICAS',
        daysAgo: 168,
        durationSeconds: 2.2,
      },
      {
        service: 'notification-service',
        incident_type: 'ProbeFailure',
        title: 'Push notification worker probe timeout',
        description: 'Hàng đợi Firebase SDK không phản hồi nhịp tim đúng hạn',
        severity: 'LOW',
        action_code: 'RESTART_POD',
        daysAgo: 175,
        durationSeconds: 1.2,
      },
    ];

    for (const ev of richIncidents) {
      const createdAt = new Date(Date.now() - ev.daysAgo * 24 * 3600 * 1000);
      const startedAt = createdAt;
      const completedAt = new Date(startedAt.getTime() + ev.durationSeconds * 1000);

      // Insert incident
      const incRes = await client.query(
        `INSERT INTO incidents (
          organization_id, environment_id, cluster_id, source_type, target_type,
          incident_type, title, description, severity, status, detected_at, started_at, resolved_at, created_at
        ) VALUES ($1, $2, $3, 'AGENT_TELEMETRY', 'WORKLOAD', $4, $5, $6, $7, 'RESOLVED', $8, $8, $9, $8)
        RETURNING id`,
        [orgId, envId, clusterId, ev.incident_type, ev.title, ev.description, ev.severity, createdAt, completedAt]
      );
      const incidentId = incRes.rows[0].id;

      // Insert healing action
      const actionTypeId = actionTypeMap.get(ev.action_code) || actionTypesRes.rows[0].id;
      await client.query(
        `INSERT INTO healing_actions (
          incident_id, environment_id, action_type_id, target_type, target_name,
          risk_level, execution_mode, approval_status, execution_status,
          started_at, completed_at, created_at
        ) VALUES ($1, $2, $3, 'SERVICE', $4, $5, 'AUTO', 'APPROVED', 'SUCCEEDED', $6, $7, $6)`,
        [
          incidentId,
          envId,
          actionTypeId,
          ev.service,
          ev.severity === 'CRITICAL' ? 'HIGH' : ev.severity === 'HIGH' ? 'MEDIUM' : 'LOW',
          startedAt,
          completedAt,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${richIncidents.length} realistic incidents & self-healing actions!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRichData();
