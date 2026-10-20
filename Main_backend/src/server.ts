import http from 'http';
import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { initAgentWebSocket } from './websocket/agentWebSocket';
import { initTelemetryWebSocket } from './websocket/telemetryWebSocket';

const startServer = async () => {
  // Test connection to PostgreSQL before opening HTTP port
  await testDbConnection();

  const server = http.createServer(app);

  // Initialize Agent WebSocket server on WS /api/v1/agent/connect
  const wss = initAgentWebSocket(server);
  // Initialize Frontend UI Telemetry WebSocket server on WS /api/v1/telemetry/ws
  const uiWss = initTelemetryWebSocket(server);

  server.listen(config.port, () => {
    console.log(`🚀 Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`🔗 Health Check: http://localhost:${config.port}${config.apiPrefix}/health`);
    console.log(`📡 Agent WebSocket: ws://localhost:${config.port}${config.apiPrefix}/agent/connect`);
    console.log(`🖥️ UI Telemetry WebSocket: ws://localhost:${config.port}${config.apiPrefix}/telemetry/ws`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Received shutdown signal, closing server gracefully...');
    uiWss.close();
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
