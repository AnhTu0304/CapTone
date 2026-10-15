import WebSocket from 'ws';
import { pool } from '../src/config/database';

const TOKEN = 'agt_dev_secret_token_2026';
const WS_URL = `ws://localhost:5000/api/v1/agent/connect?token=${TOKEN}`;
const API_BASE = 'http://localhost:5000/api/v1/telemetry';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function printDivider(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`📌 ${title}`);
  console.log('='.repeat(70));
}

async function runRealtimeSimulation() {
  console.clear();
  printDivider('KHỞI CHẠY SIMULATOR K8S AGENT REALTIME');
  console.log(`📡 Kết nối tới: ${WS_URL}`);

  const serviceId = 'checkout-service';
  const pods = ['checkout-pod-001', 'checkout-pod-002'];

  console.log(`🧹 Dọn dẹp dữ liệu kiểm thử cũ cho dịch vụ: ${serviceId}...`);
  await pool.query("DELETE FROM agent_metrics WHERE service_id = $1", [serviceId]);
  await pool.query("DELETE FROM logs WHERE metadata->>'service_id' = $1", [serviceId]);
  await pool.query("DELETE FROM kubernetes_events WHERE metadata->>'service_id' = $1", [serviceId]);

  const ws = new WebSocket(WS_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ WebSocket mở kết nối thành công!');
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.status === 'authenticated') {
        console.log(`🔑 Agent đã xác thực: ${msg.agent.name} (ID: ${msg.agent.id})`);
        resolve();
      } else if (msg.status === 'error') {
        console.error('❌ Lỗi xác thực:', msg.message);
        reject(new Error(msg.message));
      }
    });

    ws.on('error', (err) => {
      console.error('❌ Lỗi kết nối WebSocket:', err.message);
      reject(err);
    });
  });

  console.log('\n🚀 BẮT ĐẦU STREAM DỮ LIỆU REALTIME THEO 3 GIAI ĐOẠN...');
  console.log('   Mỗi nhịp gửi dữ liệu cách nhau 3 giây.');

  // Total 12 ticks
  for (let tick = 1; tick <= 12; tick++) {
    let phaseName = '';
    let cpuBase = 35;
    let ramBase = 45;
    let reqBase = 220;
    let latBase = 75;
    let restarts = 0;
    let emitLog: { level: string; msg: string } | null = null;
    let emitEvent: { type: string; reason: string; msg: string } | null = null;

    if (tick <= 4) {
      // Giai đoạn 1: Bình thường (Normal)
      phaseName = 'GIAI ĐOẠN 1: HOẠT ĐỘNG BÌNH THƯỜNG (HEALTHY)';
      cpuBase = 30 + Math.random() * 8;
      ramBase = 42 + Math.random() * 5;
      reqBase = 200 + Math.random() * 50;
      latBase = 70 + Math.random() * 20;
      if (tick % 2 === 0) {
        emitLog = { level: 'INFO', msg: `Order #${1000 + tick} placed successfully by customer` };
      }
    } else if (tick <= 8) {
      // Giai đoạn 2: Tăng tải & Bão hòa CPU (Traffic Surge / CPU Saturation)
      phaseName = 'GIAI ĐOẠN 2: TẢI ĐỘT BIẾN & BÃO HÒA CPU (TRAFFIC SURGE)';
      cpuBase = 84 + (tick - 4) * 2; // 86% -> 92%
      ramBase = 65 + (tick - 4) * 3;
      reqBase = 720 + (tick - 4) * 40; // 720 -> 880 req/s
      latBase = 210 + (tick - 4) * 15; // 210 -> 270 ms
      emitLog = { level: 'WARN', msg: `High queue latency detected: worker response ${latBase.toFixed(0)}ms` };
    } else {
      // Giai đoạn 3: Rò rỉ bộ nhớ & OOM Crash (Memory Leak & OOM)
      phaseName = 'GIAI ĐOẠN 3: SỰ CỐ OOM KILLED & POD CRASH (CRITICAL OOM)';
      cpuBase = 78 + Math.random() * 5;
      ramBase = 94 + (tick - 8) * 1.5; // 95% -> 99%
      reqBase = 580;
      latBase = 350;
      restarts = tick - 8;
      emitLog = { level: 'ERROR', msg: `OutOfMemoryError: Java heap space in checkout thread pool [worker-${tick}]` };
      emitEvent = {
        type: 'Warning',
        reason: 'OOMKilled',
        msg: 'Container order-service was killed due to memory limit reached (cgroup memory pressure)',
      };
    }

    console.log(`\n----------------------------------------------------------------------`);
    console.log(`⏱️  NHỊP [${tick}/12] - ${phaseName}`);
    console.log(`----------------------------------------------------------------------`);

    const nowIso = new Date().toISOString();

    // 1. Stream Metrics for all pods
    for (const pod of pods) {
      const podCpu = parseFloat((cpuBase + (Math.random() * 4 - 2)).toFixed(1));
      const podRam = parseFloat((ramBase + (Math.random() * 3 - 1.5)).toFixed(1));
      const podReq = Math.round(reqBase / pods.length);
      const podLat = parseFloat((latBase + (Math.random() * 10 - 5)).toFixed(1));

      const metricMsg = {
        type: 'metrics',
        data: {
          service_id: serviceId,
          pod_id: pod,
          timestamp: nowIso,
          cpu: podCpu,
          ram: podRam,
          disk: 45.0,
          request_rate: podReq,
          latency: podLat,
          http_5xx_rate: tick >= 9 ? 2.5 : 0.0,
          pod_restart_count: restarts,
          replica_count: pods.length,
        },
      };

      ws.send(JSON.stringify(metricMsg));
      console.log(`📊 [Metrics] Pod: ${pod} | CPU: ${podCpu}% | RAM: ${podRam}% | Req: ${podReq} req/s | Latency: ${podLat}ms`);
    }

    // 2. Stream Log if any
    if (emitLog) {
      const logMsg = {
        type: 'log',
        data: {
          service_id: serviceId,
          pod_id: pods[0],
          timestamp: nowIso,
          level: emitLog.level,
          message: emitLog.msg,
        },
      };
      ws.send(JSON.stringify(logMsg));
      console.log(`📝 [Log]     [${emitLog.level}] ${emitLog.msg}`);
    }

    // 3. Stream K8s Event if any
    if (emitEvent) {
      const eventMsg = {
        type: 'k8s_event',
        data: {
          service_id: serviceId,
          pod_id: pods[0],
          pod_name: `${serviceId}-7f8c9b-001`,
          status: 'CrashLoopBackOff',
          timestamp: nowIso,
          event: {
            type: emitEvent.type,
            reason: emitEvent.reason,
            message: emitEvent.msg,
          },
        },
      };
      ws.send(JSON.stringify(eventMsg));
      console.log(`🚨 [K8sEvent] [${emitEvent.type}] ${emitEvent.reason} -> ${emitEvent.msg}`);
    }

    // Wait a brief moment for ingestion
    await sleep(800);

    // 4. Query Realtime Backend Evaluation & Diagnosis
    try {
      const evalRes = await fetch(`${API_BASE}/services/${serviceId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket_seconds: 5,
          window_minutes: 15,
          auto_trigger_rca: true,
        }),
      });

      if (evalRes.ok) {
        const evalJson: any = await evalRes.json();
        const evData = evalJson.data;

        console.log(`\n🔍 KẾT QUẢ ĐÁNH GIÁ REALTIME TỪ MAIN BACKEND:`);
        console.log(`   - Điểm metrics gom gần nhất : CPU: ${evData.latest_metrics.cpu}% | RAM: ${evData.latest_metrics.ram}% | Replicas: ${evData.latest_metrics.replica_count}`);
        console.log(`   - Rule Engine Anomaly        : ${evData.rule_evaluation.is_anomalous ? '⚠️ CÓ BẤT THƯỜNG' : '✅ BÌNH THƯỜNG'}`);
        if (evData.rule_evaluation.is_anomalous) {
          console.log(`     + Danh sách bất thường     : [${evData.rule_evaluation.anomalies.join(', ')}]`);
          console.log(`     + Mức độ nghiêm trọng      : ${evData.rule_evaluation.severity}`);
        }
        if (evData.gru_prediction) {
          console.log(`   - GRU Dự báo rủi ro 15 phút  : ${evData.gru_prediction.primary_risk} (Độ tin cậy: ${(evData.gru_prediction.confidence_score * 100).toFixed(1)}%)`);
        }
        console.log(`   - Trạng thái kích hoạt RCA   : ${evData.rca_triggered ? '🚨 ĐÃ KÍCH HOẠT' : '💤 Chưa kích hoạt'}`);
        if (evData.rca_triggered && evData.rca_diagnosis) {
          console.log(`   🎯 KẾT QUẢ CHẨN ĐOÁN RCA:`);
          console.log(`     + Nguyên nhân gốc (Cause)  : ${evData.rca_diagnosis.root_cause.cause} (Tin cậy: ${(evData.rca_diagnosis.root_cause.confidence * 100).toFixed(1)}%)`);
          console.log(`     + Hành động đề xuất        : 💡 ${evData.rca_diagnosis.recommendation.action}`);
          console.log(`     + Lý do đề xuất            : ${evData.rca_diagnosis.recommendation.reason}`);
          console.log(`     + Mã sự cố (Incident ID)   : ${evData.rca_diagnosis.incident_id}`);
        }
      }
    } catch (err: any) {
      console.warn(`   (Đang tích lũy dữ liệu time-series cho backend: ${err.message})`);
    }

    // Wait remaining interval
    await sleep(2200);
  }

  printDivider('HOÀN TẤT SIMULATION REALTIME');
  console.log('✅ Đã mô phỏng thành công chu kỳ sống hoàn chỉnh:');
  console.log('   Healthy -> Traffic Surge (CPU High) -> OOM Crash -> Tự động phát hiện & RCA!');
  ws.close();
  await pool.end();
  process.exit(0);
}

runRealtimeSimulation().catch((err) => {
  console.error('Lỗi khi chạy simulator:', err);
  process.exit(1);
});
