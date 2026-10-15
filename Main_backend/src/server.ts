import http from 'http';
import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { initAgentWebSocket } from './websocket/agentWebSocket';

const startServer = async () => {
  // Test connection to PostgreSQL before opening HTTP port
  await testDbConnection();

  const server = http.createServer(app);

  // Initialize Agent WebSocket server on WS /api/v1/agent/connect
  const wss = initAgentWebSocket(server);

  server.listen(config.port, () => {
    console.log(`🚀 Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`🔗 Health Check: http://localhost:${config.port}${config.apiPrefix}/health`);
    console.log(`📡 Agent WebSocket: ws://localhost:${config.port}${config.apiPrefix}/agent/connect`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Received shutdown signal, closing server gracefully...');
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
