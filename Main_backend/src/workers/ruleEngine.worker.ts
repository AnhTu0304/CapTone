import dotenv from 'dotenv';
dotenv.config();

import { RuleEngineExecutionService } from '../services/ruleEngineExecution.service';
import { pool } from '../config/database';

let isRunning = false;
let timer: NodeJS.Timeout | null = null;
const EVAL_INTERVAL_MS = parseInt(process.env.RULE_ENGINE_INTERVAL_MS || '30000', 10);

async function executeCycle(): Promise<void> {
  if (isRunning) {
    console.log('[RuleEngineWorker] Chu kỳ trước chưa kết thúc, bỏ qua lần kích hoạt này.');
    return;
  }

  isRunning = true;
  try {
    await RuleEngineExecutionService.runEvaluationCycle();
  } catch (error) {
    console.error('[RuleEngineWorker] Lỗi trong chu kỳ đánh giá:', error);
  } finally {
    isRunning = false;
  }
}

async function start(): Promise<void> {
  const isOnce = process.argv.includes('--once');

  if (isOnce) {
    console.log('[RuleEngineWorker] Đang chạy một chu kỳ đánh giá duy nhất (--once)...');
    await executeCycle();
    await pool.end();
    process.exit(0);
  }

  console.log(`[RuleEngineWorker] Khởi động tiến trình Rule Engine nền (khoảng cách: ${EVAL_INTERVAL_MS}ms)...`);
  // Run first cycle immediately
  await executeCycle();

  timer = setInterval(executeCycle, EVAL_INTERVAL_MS);

  const shutdown = async () => {
    console.log('[RuleEngineWorker] Đang dừng tiến trình...');
    if (timer) clearInterval(timer);
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start worker if executed directly
if (require.main === module || process.argv[1]?.includes('ruleEngine.worker')) {
  start().catch((err) => {
    console.error('[RuleEngineWorker] Lỗi khởi động tiến trình worker:', err);
    process.exit(1);
  });
}

export { executeCycle, start };
