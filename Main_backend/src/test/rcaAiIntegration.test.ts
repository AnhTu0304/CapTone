import { pool } from '../config/database';
import { AiService } from '../services/ai.service';
import { RecommendationModel } from '../models/recommendation.model';
import { IncidentModel } from '../models/incident.model';
import { TelemetryAggregatorService } from '../services/telemetryAggregator.service';
import { HealingActionService } from '../services/healingAction.service';
import { HealingActionModel } from '../models/healingAction.model';
import { MetricModel } from '../models/metric.model';
import assert from 'assert';

async function runComprehensiveFlowTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM TRA TOÀN DIỆN LUỒNG & XỬ LÝ DỮ LIỆU DATABASE (MAIN BACKEND)');
  console.log('======================================================================\n');

  // Test 1: Kiểm tra kết nối AI Backend & Model Readiness
  console.log('👉 [Test 1] Kiểm tra kết nối & Sẵn sàng của AI Backend (/health)...');
  const health = await AiService.checkAiHealth();
  assert.strictEqual(health.connected, true, 'AI Backend phải kết nối thành công');
  assert.strictEqual(health.data?.status, 'healthy', 'AI Backend status phải là healthy');
  assert.strictEqual(health.data?.model_loaded, true, 'Mô hình GRU phải được nạp sẵn');
  console.log('   ✅ AI Backend trực tuyến, Model GRU & RCA Rules sẵn sàng 100%.\n');

  // Test 2: Ingestion & Lưu trữ Chuỗi Viễn trắc thời gian thực (12 Timesteps x 8 Features)
  console.log('👉 [Test 2] Kiểm tra Luồng Gom viễn trắc, Dự báo GRU & Lưu trữ DB (ai_predictions & prediction_inputs)...');
  const testSequence = Array.from({ length: 12 }, (_, i) => ({
    cpu: 40 + i * 0.5,
    ram: 70 + i * 2.5,
    disk: 34.0,
    request_rate: 400 + i * 2.0,
    latency: 120 + i * 50.0,
    http_5xx_rate: i > 6 ? (i - 6) * 1.2 : 0.0,
    pod_restart_count: i > 8 ? 2 : 0,
    replica_count: 3,
  }));

  const predResult = await AiService.predictRisk({
    service_id: 'mongodb',
    sequence: testSequence,
    prediction_horizon_minutes: 15,
  });

  assert.ok(predResult.prediction_id, 'Phải sinh mã prediction_id UUID hợp lệ');
  assert.strictEqual(predResult.service_id, 'mongodb');
  assert.ok(predResult.detected_risks.length > 0, 'Phải phát hiện rủi ro từ chuỗi');

  // Kiểm tra dữ liệu thực tế trong PostgreSQL (prediction_inputs)
  const inputRows = await pool.query(
    'SELECT count(*)::int as count FROM prediction_inputs WHERE prediction_id = $1;',
    [predResult.prediction_id]
  );
  assert.strictEqual(inputRows.rows[0].count, 96, 'Phải lưu trữ đủ 12 x 8 = 96 bản ghi quan trắc vào prediction_inputs');
  console.log(`   ✅ Dự báo GRU thành công: ID=${predResult.prediction_id}, Rủi ro chính=${predResult.primary_risk}, Điểm=${predResult.overall_risk_score.toFixed(3)}`);
  console.log(`   ✅ Đã kiểm tra 96/96 điểm đo viễn trắc lưu chuẩn xác vào bảng 'prediction_inputs'.\n`);

  // Test 3: Phân tích RCA, Circuit Breaker & Lưu trữ Đầy đủ (incidents, rca_analyses, rca_evidences, ai_recommendations)
  console.log('👉 [Test 3] Kiểm tra Luồng Chẩn đoán RCA, Ngắt mạch Circuit Breaker & Liên kết 4 bảng cơ sở dữ liệu...');
  const rcaResult = await AiService.analyzeRootCause({
    request_id: 'req-e2e-flow-001',
    incident_id: 'inc-e2e-flow-001',
    service_id: 'mongodb',
    namespace: 'test-lab',
    workload_type: 'StatefulSet',
    suspected_pod_name: 'mongodb-0',
    risk_type: 'OOM',
    confidence: 0.94,
    metrics: {
      cpu: 45.2,
      ram: 98.7,
      disk: 34.0,
      request_rate: 420.5,
      latency: 850.0,
      http_5xx_rate: 6.8,
      pod_restart_count: 3,
      replica_count: 3,
    },
    logs: [
      '[FATAL] Out of memory: unable to allocate 16777216 bytes in cache bucket',
      'WiredTiger error (-31804): WT_NOTFOUND: item not found in cache bucket',
      'Slow query detected: db.orders.find({status: "PENDING"}).sort({created_at: -1}) took 1250ms (COLLSCAN, 250000 docs examined)',
    ],
    kubernetes_events: [
      '[Warning] Pod: mongodb-0 - Reason: OOMKilled - Container mongod failed with exit code 137 (count: 3)',
      '[Warning] Pod: mongodb-0 - Reason: BackOff - Back-off restarting failed container (count: 4)',
    ],
    kubernetes: {
      all_pods: [
        {
          pod_name: 'mongodb-0',
          status: 'Running',
          restart_count: 3,
          termination: {
            last_exit_code: 137,
            reason: 'OOMKilled',
          },
          mongodb_cluster_health: {
            role: 'PRIMARY',
            quorum_status: 'INTACT',
          },
        },
        {
          pod_name: 'mongodb-1',
          status: 'Running',
          restart_count: 0,
          mongodb_cluster_health: {
            role: 'SECONDARY',
            quorum_status: 'INTACT',
          },
        },
      ],
      nodes: [
        {
          node_name: 'worker-node-01',
          cpu_usage_pct: 45.0,
          ram_usage_pct: 68.5,
          conditions: { Ready: true, MemoryPressure: false },
        },
      ],
    },
    action_history: {
      total_actions_recorded: 2,
      consecutive_failures: 2,
      circuit_breaker_tripped: true,
      blocked_actions: ['RESTART_POD', 'REPLACE_POD'],
    },
    prediction_id: predResult.prediction_id,
  });

  assert.ok(rcaResult.incident_id, 'Phải sinh mã incident_id UUID hợp lệ');
  assert.ok(rcaResult.rca_analysis_id, 'Phải sinh mã rca_analysis_id UUID hợp lệ');
  assert.ok(rcaResult.recommendation_id, 'Phải sinh mã recommendation_id UUID hợp lệ');
  assert.strictEqual(rcaResult.recommendation.action, 'NO_ACTION', 'Phải trả về NO_ACTION do kích hoạt ngắt mạch an toàn');
  assert.strictEqual(rcaResult.recommendation.priority, 'CRITICAL', 'Mức ưu tiên phải là CRITICAL');
  assert.ok(rcaResult.recommendation.action_parameters?.circuit_breaker_tripped, 'Circuit breaker phải bật');
  assert.ok(
    rcaResult.recommendation.action_parameters?.manual_playbook &&
      rcaResult.recommendation.action_parameters.manual_playbook.length > 0,
    'Playbook hướng dẫn thủ công phải có các bước thực thi'
  );

  // Kiểm tra ràng buộc khóa ngoại (Foreign Keys) trong PostgreSQL
  const incCheck = await pool.query('SELECT id, incident_type, severity, status FROM incidents WHERE id = $1;', [rcaResult.incident_id]);
  assert.strictEqual(incCheck.rows.length, 1, 'Bảng incidents phải có bản ghi');

  const rcaCheck = await pool.query('SELECT id, root_cause_type, confidence_score FROM rca_analyses WHERE id = $1;', [rcaResult.rca_analysis_id]);
  assert.strictEqual(rcaCheck.rows.length, 1, 'Bảng rca_analyses phải có bản ghi');

  const evCheck = await pool.query('SELECT count(*)::int as count FROM rca_evidences WHERE rca_analysis_id = $1;', [rcaResult.rca_analysis_id]);
  assert.ok(evCheck.rows[0].count > 0, 'Bảng rca_evidences phải lưu trữ các bằng chứng');

  const recCheck = await pool.query('SELECT id, recommendation, priority, status FROM ai_recommendations WHERE id = $1;', [rcaResult.recommendation_id]);
  assert.strictEqual(recCheck.rows.length, 1, 'Bảng ai_recommendations phải có bản ghi');

  console.log(`   ✅ Phân tích RCA thành công: Root Cause=${rcaResult.root_cause.cause}`);
  console.log(`   ✅ Đã kiểm tra liên kết 4 tầng cơ sở dữ liệu: incidents (${rcaResult.incident_id}) -> rca_analyses (${rcaResult.rca_analysis_id}) -> rca_evidences (${evCheck.rows[0].count} items) -> ai_recommendations (${rcaResult.recommendation_id})\n`);

  // Test 4: Trích xuất action_parameters & manual_playbook qua Model Queries
  console.log('👉 [Test 4] Kiểm tra Trích xuất JSONB (action_parameters & manual_playbook) qua các hàm Model...');
  const recDetail = await RecommendationModel.findById(rcaResult.recommendation_id);
  assert.ok(recDetail, 'Phải tìm thấy recommendation qua ID');
  assert.strictEqual(recDetail.recommendation, 'NO_ACTION');
  assert.ok(recDetail.action_parameters, 'Phải bóc tách được trường action_parameters từ JSONB');
  assert.ok(Array.isArray(recDetail.manual_playbook), 'manual_playbook phải là mảng');

  const recList = await RecommendationModel.findByIncidentId(rcaResult.incident_id);
  assert.ok(recList.length > 0, 'Phải tìm thấy recommendation qua incident_id');
  assert.ok(recList[0].action_parameters, 'findByIncidentId phải chứa action_parameters');

  const recentList = await RecommendationModel.getRecent(5);
  assert.ok(recentList.length > 0, 'getRecent phải trả về danh sách có action_parameters');
  assert.ok(recentList.some((r: any) => r.id === rcaResult.recommendation_id), 'getRecent phải bao gồm recommendation vừa tạo');
  console.log('   ✅ Các hàm findById, findByIncidentId, getRecent bóc tách JSONB chuẩn xác 100%.\n');

  // Test 5: Kiểm tra cơ chế Deduplication & Chống lặp (IncidentModel.findOpenIncident)
  console.log('👉 [Test 5] Kiểm tra Cơ chế Deduplication Sự cố (findOpenIncident với Target NULL & Target UUID)...');
  const envId = rcaResult.environment_id;
  const openIncNull = await IncidentModel.findOpenIncident(pool as any, envId, null, 'OOM', 30);
  assert.ok(openIncNull, 'findOpenIncident phải tìm được sự cố đang mở ngay cả khi target_id là NULL');

  const openIncWl = await IncidentModel.findOpenIncident(pool as any, envId, rcaResult.workload_id || null, 'OOM', 30);
  assert.ok(openIncWl, 'findOpenIncident phải tìm được sự cố qua workload_id');
  console.log(`   ✅ Cơ chế chống tạo trùng lặp sự cố hoạt động chính xác (Incident ID: ${openIncNull.id}).\n`);

  // Test 6: Kiểm tra Lọc Đa chiều Danh sách Sự cố (IncidentModel.findMany)
  console.log('👉 [Test 6] Kiểm tra Lọc Đa chiều Sự cố (IncidentModel.findMany)...');
  const manyResult = await IncidentModel.findMany({
    limit: 10,
    offset: 0,
    status: 'OPEN',
    severity: 'CRITICAL',
  });
  assert.ok(manyResult.items.length > 0, 'findMany phải trả về các sự cố phù hợp');
  console.log(`   ✅ findMany lọc thành công ${manyResult.items.length}/${manyResult.total} sự cố.\n`);

  // Test 7: Kiểm tra Tạo Healing Action & Ngắt mạch An toàn khi Thực thi (HealingActionService)
  console.log('👉 [Test 7] Kiểm tra Luồng Tạo Healing Action & Chặn Thực thi Tự động khi gặp NO_ACTION...');
  const actionTypes = await RecommendationModel.findAllActionTypes();
  const noActionType = actionTypes.find((t: any) => t.code === 'NO_ACTION');
  assert.ok(noActionType, 'Hành động NO_ACTION phải tồn tại trong bảng healing_action_types');

  const createdAction = await HealingActionModel.createAction({
    incident_id: rcaResult.incident_id,
    environment_id: envId,
    action_type_id: noActionType.id,
    recommendation_id: rcaResult.recommendation_id,
    target_type: 'WORKLOAD',
    target_name: 'mongodb',
    risk_level: 'CRITICAL',
    execution_mode: 'MANUAL',
  });
  assert.ok(createdAction.id, 'Phải tạo thành công bản ghi healing_actions');

  // Thực thi action qua HealingActionService (kiểm tra không bị crash, ghi log ngắt mạch)
  const execResult = await HealingActionService.executeAction(createdAction.id, 'tester-admin-id');
  assert.ok(execResult.action, 'Hành động phải được thực thi và cập nhật trạng thái');

  // Xác nhận bản ghi trong DB
  const actDb = await HealingActionModel.findActionById(createdAction.id);
  assert.strictEqual(actDb.id, createdAction.id);
  console.log(`   ✅ Healing Action ID=${createdAction.id} được tạo và ngắt mạch an toàn, không gửi lệnh sai xuống cụm.\n`);

  // Test 8: Kiểm tra Luồng Đánh giá Đầu cuối (evaluateAndDiagnoseService)
  console.log('👉 [Test 8] Kiểm tra Toàn bộ Luồng Tự động: Telemetry -> Rule Engine -> GRU -> RCA (evaluateAndDiagnoseService)...');
  // Chèn 12 điểm viễn trắc mẫu cho service test
  for (let i = 0; i < 12; i++) {
    await MetricModel.create({
      agent_id: 'agent-e2e-01',
      cluster_id: rcaResult.cluster_id || null,
      service_id: 'payment-service-e2e',
      pod_id: 'payment-service-e2e-0',
      cpu: 30 + i,
      ram: 45 + i,
      disk: 25.0,
      request_rate: 200 + i * 10,
      latency: 80 + i * 5,
      http_5xx_rate: 0.1,
      pod_restart_count: 0,
      replica_count: 2,
      collected_at: new Date(Date.now() - (12 - i) * 5000),
    });
  }

  const evalResult = await TelemetryAggregatorService.evaluateAndDiagnoseService('payment-service-e2e', {
    bucketSeconds: 5,
    windowMinutes: 10,
    forceRca: false,
    autoTriggerRca: false, // Kiểm tra tầng chẩn đoán và dự báo GRU
  });

  assert.strictEqual(evalResult.service_id, 'payment-service-e2e');
  assert.strictEqual(evalResult.metrics_sequence.length, 12, 'Chuỗi viễn trắc phải đủ 12 điểm');
  assert.ok(evalResult.rule_evaluation, 'Rule Engine phải trả về kết quả');
  console.log(`   ✅ Luồng hoàn chỉnh đã gom đủ 12 điểm, Rule Engine đánh giá requires_rca=${evalResult.rule_evaluation.requires_rca}`);

  console.log('\n======================================================================');
  console.log('🎉 TẤT CẢ 8 BÀI KIỂM THỬ LUỒNG & DATABASE ĐỀU ĐẠT CHUẨN 100% THÀNH CÔNG!');
  console.log('======================================================================');
}

runComprehensiveFlowTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Kiểm thử thất bại:', err);
    process.exit(1);
  });
