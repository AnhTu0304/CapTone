import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { pool } from '../config/database';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get organization and environment
    const orgRes = await client.query("SELECT id, name FROM organizations WHERE name = 'Cloud DevOps Engineering Hub' LIMIT 1");
    if (orgRes.rows.length === 0) {
      console.error('Organization not found');
      return;
    }
    const orgId = orgRes.rows[0].id;

    const envRes = await client.query("SELECT id FROM environments WHERE organization_id = $1 LIMIT 1", [orgId]);
    const envId = envRes.rows[0].id;

    const clusterRes = await client.query("SELECT id FROM clusters WHERE environment_id = $1 LIMIT 1", [envId]);
    const clusterId = clusterRes.rows[0].id;

    const nsRes = await client.query("SELECT id FROM namespaces WHERE cluster_id = $1 AND name = 'default' LIMIT 1", [clusterId]);
    const nsId = nsRes.rows[0].id;

    console.log(`Seeding data for Org: ${orgId}, Env: ${envId}, Cluster: ${clusterId}`);

    // 2. Ensure microservices exist in services table
    const microservices = [
      { name: 'payment-service', type: 'ClusterIP', ip: '10.96.12.14' },
      { name: 'api-gateway', type: 'LoadBalancer', ip: '10.96.10.88' },
      { name: 'auth-service', type: 'ClusterIP', ip: '10.96.22.50' },
      { name: 'order-processor', type: 'ClusterIP', ip: '10.96.45.19' },
      { name: 'notification-service', type: 'ClusterIP', ip: '10.96.88.7' },
    ];

    for (const svc of microservices) {
      const existing = await client.query(
        "SELECT id FROM services WHERE cluster_id = $1 AND name = $2",
        [clusterId, svc.name]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO services (cluster_id, namespace_id, name, service_type, cluster_ip, status)
           VALUES ($1, $2, $3, $4, $5, 'Active')`,
          [clusterId, nsId, svc.name, svc.type, svc.ip]
        );
        console.log(`Inserted service ${svc.name}`);
      }
    }

    // 3. Get action types
    const actionTypesRes = await client.query("SELECT id, code FROM healing_action_types");
    const actionTypeMap = new Map<string, string>();
    actionTypesRes.rows.forEach(r => actionTypeMap.set(r.code, r.id));

    // 4. Seed realistic incidents and self-healing actions
    const sampleEvents = [
      {
        service: 'order-processor',
        incident_type: 'CrashLoopBackOff',
        title: 'CrashLoopBackOff detected on order-processor-v2',
        description: 'Tỷ lệ lỗi tăng vọt 15% sau khi triển khai phiên bản mới',
        severity: 'HIGH',
        action_code: 'ROLLBACK_DEPLOYMENT',
        action_desc: 'Tự động khôi phục bản Deployment trước do phát hiện tỷ lệ lỗi tăng cao',
        hoursAgo: 2,
        durationSeconds: 2.3
      },
      {
        service: 'payment-service',
        incident_type: 'OOMKilled',
        title: 'OOMKilled on payment-service-pod-01',
        description: 'Pod bị cạn kiệt bộ nhớ do tải giao dịch tăng đột biến',
        severity: 'CRITICAL',
        action_code: 'RESTART_POD',
        action_desc: 'Khởi động lại Pod bị OOMKilled và tái phân bổ bộ nhớ',
        hoursAgo: 6,
        durationSeconds: 1.4
      },
      {
        service: 'api-gateway',
        incident_type: 'HighTrafficSpike',
        title: 'CPU Usage exceeded 85% on api-gateway',
        description: 'Lưu lượng truy cập vượt ngưỡng an toàn',
        severity: 'MEDIUM',
        action_code: 'SCALE_REPLICAS',
        action_desc: 'Tăng bản sao Pod từ 2 lên 4 do lưu lượng tải vượt ngưỡng 85%',
        hoursAgo: 24,
        durationSeconds: 1.8
      },
      {
        service: 'auth-service',
        incident_type: 'ProbeFailure',
        title: 'Readiness probe failed on auth-service-worker-2',
        description: 'Readiness check timeout liên tiếp 3 lần',
        severity: 'LOW',
        action_code: 'RESTART_POD',
        action_desc: 'Tự động khởi động lại container auth-service phục hồi kết nối Redis',
        hoursAgo: 48,
        durationSeconds: 1.2
      },
      {
        service: 'notification-service',
        incident_type: 'DiskPressure',
        title: 'Disk space warning on notification-service pod',
        description: 'Dung lượng log tạm thời chiếm hơn 90% thư mục spool',
        severity: 'LOW',
        action_code: 'CLEANUP_TEMPORARY_FILES',
        action_desc: 'Tự động dọn dẹp file log rác và giải phóng 3.2GB bộ nhớ đệm',
        hoursAgo: 72,
        durationSeconds: 1.9
      }
    ];

    for (const ev of sampleEvents) {
      const createdAt = new Date(Date.now() - ev.hoursAgo * 3600 * 1000);
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
        [incidentId, envId, actionTypeId, ev.service, ev.severity === 'CRITICAL' ? 'HIGH' : 'LOW', startedAt, completedAt]
      );
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${sampleEvents.length} incidents and healing actions!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
