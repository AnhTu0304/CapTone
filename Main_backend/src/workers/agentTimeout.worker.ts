import { pool } from '../config/database';
import { AgentTimeoutService } from '../services/agentTimeout.service';

/**
 * Background Worker kiểm tra và tự động cập nhật trạng thái Agent quá hạn Heartbeat
 * Chạy độc lập: npm run worker:agent-timeout
 * Cờ hỗ trợ: --once (chạy một lần duy nhất rồi thoát)
 */
async function startWorker() {
  const isOnce = process.argv.includes('--once');
  const timeoutSeconds = AgentTimeoutService.getTimeoutThresholdSeconds();
  const intervalSeconds = AgentTimeoutService.getCheckIntervalSeconds();
  const intervalMs = Math.max(1, intervalSeconds) * 1000;

  console.log('🛡️ [AGENT TIMEOUT WORKER] Khởi động Agent Heartbeat Timeout Monitor Worker...');
  console.log(`⏱️ [AGENT TIMEOUT WORKER] Ngưỡng Timeout: ${timeoutSeconds}s | Chu kỳ quét: ${intervalSeconds}s`);
  console.log(`📋 [AGENT TIMEOUT WORKER] Chế độ: ${isOnce ? 'ONE-SHOT (Thực thi 1 lần rồi thoát)' : 'DAEMON (Chạy định kỳ)'}`);

  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;

  const runTask = async () => {
    if (isRunning) {
      console.warn('⚠️ [AGENT TIMEOUT WORKER] Chu kỳ trước vẫn đang chạy. Bỏ qua chu kỳ này.');
      return;
    }

    isRunning = true;
    try {
      const stats = await AgentTimeoutService.checkAndMarkStaleAgents(timeoutSeconds);
      if (stats.stale_agents_count > 0) {
        console.log(`⚠️ [AGENT TIMEOUT WORKER] Phát hiện ${stats.stale_agents_count} Agent quá hạn nhịp tim. Đã chuyển sang OFFLINE.`);
      }
    } catch (err: any) {
      console.error('❌ [AGENT TIMEOUT WORKER] Lỗi khi quét trạng thái Agent:', err.message);
    } finally {
      isRunning = false;
    }
  };

  // Chạy ngay chu kỳ đầu tiên
  await runTask();

  if (isOnce) {
    console.log('👋 [AGENT TIMEOUT WORKER] One-shot hoàn tất. Kết thúc tiến trình worker.');
    await pool.end();
    process.exit(0);
  }

  timer = setInterval(runTask, intervalMs);

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [AGENT TIMEOUT WORKER] Nhận tín hiệu ${signal}. Dừng worker an toàn...`);
    if (timer) clearInterval(timer);
    await pool.end();
    console.log('👋 [AGENT TIMEOUT WORKER] Worker đã dừng thành công.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch(async (err) => {
  console.error('💥 [AGENT TIMEOUT WORKER] Lỗi khởi tạo worker:', err);
  await pool.end();
  process.exit(1);
});
