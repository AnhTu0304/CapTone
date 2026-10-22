import http from 'http';
import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { testRedisConnection, closeRedis } from './config/redis';
import { initAgentWebSocket } from './websocket/agentWebSocket';
import { initTelemetryWebSocket } from './websocket/telemetryWebSocket';
import { TelemetryPipelineService } from './services/telemetryPipeline.service';
import { EmailWorker } from './services/emailQueue.service';

const startServer = async () => {
  // Test connection to PostgreSQL before opening HTTP port
  await testDbConnection();

  // Test connection to Redis Cache
  await testRedisConnection();

  // Start background Email Queue Worker (if in-process worker enabled)
  if (config.email.inProcessWorker) {
    await EmailWorker.start(1000);
  }

  const server = http.createServer(app);

  // Initialize Agent WebSocket server on WS /api/v1/agent/connect
  const wss = initAgentWebSocket(server);
  // Initialize Frontend UI Telemetry WebSocket server on WS /api/v1/telemetry/ws
  const uiWss = initTelemetryWebSocket(server);

  // Start continuous AI Ingestion, Forecast & Partitioning Pipeline
  TelemetryPipelineService.startPipeline(10);

  server.listen(config.port, () => {
    console.log(`🚀 Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`🔗 Health Check: http://localhost:${config.port}${config.apiPrefix}/health`);
    console.log(`📡 Agent WebSocket: ws://localhost:${config.port}${config.apiPrefix}/agent/connect`);
    console.log(`🖥️ UI Telemetry WebSocket: ws://localhost:${config.port}${config.apiPrefix}/telemetry/ws`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Received shutdown signal, closing server gracefully...');
    TelemetryPipelineService.stopPipeline();
    await EmailWorker.stop();
    uiWss.close();
    await closeRedis();
    wss.close(() => {
      server.close(() => {
        console.log('HTTP & WebSocket server closed.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
