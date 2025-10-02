import app from './app';
import { endPool } from './database/db';
import { cronService } from './services/cronService';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 QiFlow Control Center API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Start background jobs
  cronService.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  cronService.stop();
  server.close(async () => {
    console.log('HTTP server closed');
    await endPool();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  cronService.stop();
  server.close(async () => {
    console.log('HTTP server closed');
    await endPool();
    process.exit(0);
  });
});

export default server;
