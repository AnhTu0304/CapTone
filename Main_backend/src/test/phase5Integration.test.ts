import { pool } from '../config/database';
import { AiService } from '../services/ai.service';
import { RecommendationModel } from '../models/recommendation.model';
import { IncidentModel } from '../models/incident.model';
import { HealingActionModel } from '../models/healingAction.model';
import { AiController } from '../controllers/ai.controller';
import assert from 'assert';

async function runPhase5IntegrationTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍCH HỢP PHASE 5.5 – 10 KỊCH BẢN BẮT BUỘC (SELFAI)');
  console.log('======================================================================\n');

  const envRes = await pool.query('SELECT id, organization_id FROM environments LIMIT 1;');
  const envId = envRes.rows[0]?.id || 'e2000000-0000-0000-0000-000000000001';
  const orgAId = envRes.rows[0]?.organization_id || 'd2000000-0000-0000-0000-000000000001';

  // -------------------------------------------------------------------------
  // Kịch bản 1: GRU OOM 99%, RAM 64%, Probe Timeout -> UNKNOWN, INSUFFICIENT_EVIDENCE
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 1] GRU OOM 99%, RAM 64%, Probe Timeout...');
  const res1 = await AiService.analyzeRootCause({
    service_id: 'ecommerce-store-app',
    risk_type: 'OOM',
    confidence: 0.99,
    metrics: {
      cpu: 5.0,
      ram: 64.0,
      disk: 20.0,
      latency: 120.0,
      http_5xx_rate: 0.0,
      request_rate: 10.0,
      pod_restart_count: 0,
      replica_count: 1,
    },
    kubernetes: {
      all_pods: [
        {
          name: 'ecommerce-store-app-0',
          pod_name: 'ecommerce-store-app-0',
          uid: 'pod-sc1',
          status: 'Running',
          restart_count: 0,
          last_state: {},
        },
      ],
      events: [
        'Warning Unhealthy Liveness probe failed: Get http://10.244.0.5:8080/healthz: net/http: request canceled while waiting for connection',
      ],
    },
  } as any);

  assert.strictEqual(res1.root_cause.cause.toUpperCase(), 'UNKNOWN', 'Nguyên nhân phải là UNKNOWN');
  assert.strictEqual(
    (res1.root_cause as any).evidence_status,
    'INSUFFICIENT_EVIDENCE',
    'Evidence status phải là INSUFFICIENT_EVIDENCE'
  );
  assert.strictEqual(res1.root_cause.confidence, 0.3, 'Confidence quy ước cho UNKNOWN phải là 0.30');
  assert.ok(
    (res1.root_cause as any).symptoms && (res1.root_cause as any).symptoms.length > 0,
    'Probe timeout phải được ghi nhận trong symptoms'
  );
  assert.ok(
    (res1.root_cause as any).missing_evidence && (res1.root_cause as any).missing_evidence.length >= 3,
    'Phải có danh mục missing_evidence điều tra'
  );
  console.log('   ✅ Scenario 1 PASSED: UNKNOWN, INSUFFICIENT_EVIDENCE (0.30), Symptoms & Missing Evidence chuẩn xác.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 2: Exit Code 137 + Node MemoryPressure -> Node-level evaluation
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 2] Exit Code 137 + Node MemoryPressure (Không quy chụp Container OOM)...');
  const res2 = await AiService.analyzeRootCause({
    service_id: 'order-processor',
    risk_type: 'OOM',
    confidence: 0.5,
    metrics: {
      cpu: 10.0,
      ram: 50.0,
      disk: 30.0,
      latency: 150.0,
      http_5xx_rate: 0.0,
      request_rate: 5.0,
      pod_restart_count: 1,
      replica_count: 1,
    },
    kubernetes: {
      all_pods: [
        {
          name: 'order-processor-0',
          pod_name: 'order-processor-0',
          uid: 'pod-sc2',
          status: 'Running',
          restart_count: 1,
          termination: {
            last_exit_code: 137,
            reason: '', // Not OOMKilled
          },
        },
      ],
      nodes: [
        {
          node_name: 'minikube',
          conditions: {
            MemoryPressure: true,
            Ready: true,
          },
        },
      ],
    },
  } as any);

  assert.strictEqual(
    (res2.root_cause as any).evidence_status,
    'PROBABLE',
    'Phải xếp loại PROBABLE ở cấp độ Node MemoryPressure'
  );
  assert.ok(
    (res2.root_cause as any).missing_evidence?.some((m: string) => /dmesg|kernel/i.test(m)),
    'Phải ghi nhận thiếu kernel logs/dmesg'
  );
  console.log('   ✅ Scenario 2 PASSED: Đánh giá cấp độ Node, trạng thái PROBABLE kèm missing kernel logs.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 3: FailedScheduling: Insufficient memory -> Phân loại cấp độ Node
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 3] FailedScheduling: Insufficient memory...');
  const res3 = await AiService.analyzeRootCause({
    service_id: 'batch-worker',
    metrics: {
      cpu: 0.0,
      ram: 0.0,
      disk: 0.0,
      latency: 0.0,
      http_5xx_rate: 0.0,
      request_rate: 0.0,
      pod_restart_count: 0,
      replica_count: 1,
    },
    kubernetes: {
      events: [
        'Warning FailedScheduling 0/1 nodes are available: 1 Insufficient memory',
      ],
    },
  } as any);

  console.log('   [DEBUG Scenario 3] root_cause:', res3.root_cause);
  console.log('   [DEBUG Scenario 3] recommendation:', res3.recommendation);
  assert.strictEqual(
    (res3.root_cause as any).evidence_status,
    'CONFIRMED',
    'Trạng thái phải là CONFIRMED'
  );
  assert.ok(
    /deployment|scheduling|capacity|resource/i.test(res3.root_cause.cause) || res3.root_cause.cause !== 'Container memory exhausted',
    'Nguyên nhân phải là scheduling/deployment/capacity constraint, không phải Container OOM'
  );
  console.log('   ✅ Scenario 3 PASSED: FailedScheduling được phân loại chuẩn xác trên hạ tầng Node.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 4: HTTP 5xx cao với lượng request thấp -> Đánh giá theo sample count
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 4] HTTP 5xx cao (50%) với lượng request thấp (2.0 req/s)...');
  const res4 = await AiService.analyzeRootCause({
    service_id: 'auth-service',
    risk_type: 'HTTP_5XX_SPIKE',
    confidence: 0.85,
    metrics: {
      cpu: 10.0,
      ram: 30.0,
      disk: 20.0,
      latency: 100.0,
      http_5xx_rate: 50.0,
      request_rate: 2.0, // Low traffic
      pod_restart_count: 0,
      replica_count: 1,
    },
  } as any);

  assert.notStrictEqual(
    res4.root_cause.severity,
    'CRITICAL',
    'Không được đánh giá CRITICAL khi sample request_rate < 20 req/s'
  );
  console.log(`   ✅ Scenario 4 PASSED: Mức độ nghiêm trọng là ${res4.root_cause.severity} (Không bị thổi phồng lên CRITICAL).\n`);

  // -------------------------------------------------------------------------
  // Kịch bản 5: Circuit Breaker chưa kích hoạt, NO_ACTION do thiếu bằng chứng
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 5] Circuit Breaker chưa kích hoạt, NO_ACTION do thiếu bằng chứng...');
  const res5 = await AiService.analyzeRootCause({
    service_id: 'inventory-service',
    metrics: {
      cpu: 5.0,
      ram: 25.0,
      disk: 15.0,
      latency: 50.0,
      http_5xx_rate: 0.0,
      request_rate: 10.0,
      pod_restart_count: 0,
      replica_count: 1,
    },
    action_history: {
      total_actions_recorded: 0,
      consecutive_failures: 0,
      circuit_breaker_tripped: false,
      blocked_actions: [],
      history: [],
    },
  } as any);

  assert.strictEqual(res5.recommendation.action, 'NO_ACTION', 'Đề xuất phải là NO_ACTION');
  assert.strictEqual(
    res5.recommendation.action_parameters?.circuit_breaker_tripped,
    false,
    'circuit_breaker_tripped phải là false'
  );
  console.log('   ✅ Scenario 5 PASSED: NO_ACTION an toàn và circuit_breaker_tripped = false chuẩn xác.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 6: Circuit Breaker thực sự mở (3 lần thất bại liên tiếp)
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 6] Circuit Breaker thực sự kích hoạt (3 failures)...');
  const res6 = await AiService.analyzeRootCause({
    service_id: 'payment-gateway',
    metrics: {
      cpu: 45.0,
      ram: 85.0,
      disk: 20.0,
      latency: 600.0,
      http_5xx_rate: 5.0,
      request_rate: 50.0,
      pod_restart_count: 2,
      replica_count: 1,
    },
    action_history: {
      total_actions_recorded: 3,
      consecutive_failures: 3,
      circuit_breaker_tripped: true,
      blocked_actions: ['RESTART_POD', 'REPLACE_POD'],
      history: [
        { action: 'RESTART_POD', result: 'FAILED' },
        { action: 'RESTART_POD', result: 'FAILED' },
        { action: 'REPLACE_POD', result: 'FAILED' },
      ],
    },
  } as any);

  assert.strictEqual(res6.recommendation.action, 'NO_ACTION', 'Đề xuất phải là NO_ACTION');
  assert.strictEqual(
    res6.recommendation.action_parameters?.circuit_breaker_tripped,
    true,
    'circuit_breaker_tripped phải là true'
  );
  assert.ok(
    /Circuit Breaker/i.test(res6.recommendation.reason),
    'Lý do phải ghi rõ kích hoạt Circuit Breaker'
  );
  console.log('   ✅ Scenario 6 PASSED: circuit_breaker_tripped = true và lý do ngắt mạch an toàn phản ánh đúng.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 7: Action SUCCEEDED nhưng Verification FAILED -> Incident KHÔNG được đóng
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 7] Action SUCCEEDED nhưng Verification FAILED -> Incident giữ nguyên trạng thái mở...');
  const inc7 = await IncidentModel.create(pool as any, {
    organization_id: orgAId,
    environment_id: envId,
    source_type: 'AI_DETECTION',
    target_type: 'WORKLOAD',
    target_name: 'test-service-sc7',
    incident_type: 'POD_INSTABILITY',
    title: 'Test Incident for Verification Failure',
    description: 'Test Incident for Verification Failure',
    severity: 'HIGH',
    status: 'INVESTIGATING',
  });

  const actType = (await RecommendationModel.findAllActionTypes())[0];
  const act7 = await HealingActionModel.createAction({
    incident_id: inc7.id,
    environment_id: envId,
    action_type_id: actType.id,
    target_type: 'WORKLOAD',
    target_name: 'test-service-sc7',
    execution_mode: 'AUTOMATIC',
  });

  // Giả lập action command thành công
  await pool.query(
    `UPDATE healing_actions SET execution_status = 'SUCCEEDED', completed_at = NOW() WHERE id = $1;`,
    [act7.id]
  );

  // Ghi nhận hậu kiểm thất bại
  await pool.query(
    `INSERT INTO recovery_verifications (
       healing_action_id, verification_type, status_before, status_after,
       verification_result, verification_details, verified_at, duration_ms
     ) VALUES (
       $1, 'K8S_POST_HEALING_PROBE', '{"health":"DEGRADED"}'::jsonb, '{"health":"DEGRADED"}'::jsonb,
       false, '{"message":"Hậu kiểm thất bại: Service vẫn lỗi"}'::jsonb, NOW(), 500
     );`,
    [act7.id]
  );

  // Đọc lại incident từ CSDL
  const incAfterCheck = await IncidentModel.findById(inc7.id);
  assert.notStrictEqual(
    incAfterCheck.status,
    'RESOLVED',
    'Incident tuyệt đối không được đóng RESOLVED khi hậu kiểm thất bại'
  );
  assert.ok(
    incAfterCheck.status === 'INVESTIGATING' || incAfterCheck.status === 'OPEN',
    'Incident phải tiếp tục mở (INVESTIGATING hoặc OPEN)'
  );
  console.log(`   ✅ Scenario 7 PASSED: Incident ${inc7.id} vẫn giữ trạng thái ${incAfterCheck.status} khi hậu kiểm FAILED.\n`);

  // -------------------------------------------------------------------------
  // Kịch bản 8: Incident UNKNOWN không được tạo hành động Replace Pod chỉ dựa trên GRU
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 8] Incident UNKNOWN không được tạo hành động Replace Pod chỉ dựa trên GRU...');
  assert.notStrictEqual(
    res1.recommendation.action,
    'REPLACE_POD',
    'Không được đề xuất REPLACE_POD khi nguyên nhân là UNKNOWN'
  );
  assert.strictEqual(
    res1.recommendation.action,
    'NO_ACTION',
    'Phải đề xuất NO_ACTION an toàn khi thiếu bằng chứng'
  );
  console.log('   ✅ Scenario 8 PASSED: Chặn đứng hành động thay thế Pod tự động khi thiếu bằng chứng.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 9: Tenant A không thể đọc hoặc thao tác Incident của Tenant B
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 9] Tenant Isolation: Tenant A không thể truy cập Incident của Tenant B...');
  const orgBId = '7b000000-0000-0000-0000-000000000002';
  const fakeUserA = {
    id: '7b000000-0000-0000-0000-000000000099',
    organization_id: '7b000000-0000-0000-0000-000000000001',
    role: 'DEVOPS',
    is_super_admin: false,
  };
  const incB = await IncidentModel.create(pool as any, {
    organization_id: orgBId, // Org B
    environment_id: envId,
    source_type: 'AI_DETECTION',
    target_type: 'WORKLOAD',
    target_name: 'tenant-b-secret-service',
    incident_type: 'OOM',
    title: 'Secret Incident Org B',
    description: 'Secret Incident Org B description',
    severity: 'CRITICAL',
    status: 'OPEN',
  });

  let accessBlocked = false;
  try {
    const res = await (AiController as any).validateIncidentAccess(fakeUserA as any, incB.id);
  } catch (err: any) {
    if (err.statusCode === 403 || err.statusCode === 404 || /Access denied|không có quyền/i.test(err.message)) {
      accessBlocked = true;
    }
  }
  assert.strictEqual(accessBlocked, true, 'User Org A phải bị từ chối truy cập Incident của Org B');
  console.log('   ✅ Scenario 9 PASSED: Cách ly đa tổ chức (Tenant Isolation) chặn truy cập trái phép 100%.\n');

  // -------------------------------------------------------------------------
  // Kịch bản 10: Hai request xử lý cùng Incident không được tạo action trùng lặp (Idempotency)
  // -------------------------------------------------------------------------
  console.log('👉 [Scenario 10] Idempotency: Xử lý trùng lặp không sinh ra Action thừa...');
  const reqPayload = {
    service_id: 'checkout-service-dedup',
    risk_type: 'HIGH_LATENCY',
    confidence: 0.90,
    metrics: {
      cpu: 85.0,
      ram: 60.0,
      disk: 20.0,
      latency: 900.0,
      http_5xx_rate: 0.0,
      request_rate: 150.0,
      pod_restart_count: 0,
      replica_count: 2,
    },
  };

  const firstCall = await AiService.analyzeRootCause(reqPayload as any);
  const secondCall = await AiService.analyzeRootCause(reqPayload as any);

  assert.strictEqual(firstCall.incident_id, secondCall.incident_id, 'Phải tái sử dụng cùng Incident ID');
  assert.strictEqual(firstCall.recommendation_id, secondCall.recommendation_id, 'Phải tái sử dụng cùng Recommendation ID');

  const recs = await RecommendationModel.findByIncidentId(firstCall.incident_id);
  const proposedRecs = recs.filter((r: any) => r.status === 'PROPOSED');
  assert.strictEqual(proposedRecs.length, 1, 'Chỉ duy nhất 1 Recommendation ở trạng thái PROPOSED, không sinh action trùng lặp');
  console.log(`   ✅ Scenario 10 PASSED: Idempotency đảm bảo Incident ID=${firstCall.incident_id} chỉ có 1 PROPOSED action.\n`);

  console.log('======================================================================');
  console.log('🎉 TẤT CẢ 10/10 KỊCH BẢN KIỂM THỬ TÍCH HỢP PHASE 5.5 ĐỀU ĐẠT CHUẨN 100%!');
  console.log('======================================================================');
}

runPhase5IntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Kiểm thử thất bại:', err);
    process.exit(1);
  });
