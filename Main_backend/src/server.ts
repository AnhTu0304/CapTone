import app from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`🚀 Server is running on port ${config.port} in ${config.nodeEnv} mode`);
  console.log(`🔗 Health Check: http://localhost:${config.port}${config.apiPrefix}/health`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
