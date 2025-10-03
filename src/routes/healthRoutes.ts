import express, { Request, Response } from 'express';
import { query } from '../database/db';

const router = express.Router();

// Uptime tracking
const startTime = Date.now();

/**
 * Basic health check
 * GET /health
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'QiFlow Control Center API',
  });
});

/**
 * Detailed health check with database and service status
 * GET /health/detailed
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  const startCheck = Date.now();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const healthStatus: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'QiFlow Control Center API',
    version: process.env.npm_package_version || '1.0.0',
    uptime: {
      seconds: uptime,
      human: formatUptime(uptime),
    },
    checks: {
      database: { status: 'unknown', responseTime: 0 },
      memory: { status: 'ok', usage: {} },
      process: { status: 'ok', pid: process.pid },
    },
  };

  // Database health check
  try {
    const dbStart = Date.now();
    await query('SELECT 1 as health_check');
    const dbResponseTime = Date.now() - dbStart;

    healthStatus.checks.database = {
      status: dbResponseTime < 1000 ? 'ok' : 'slow',
      responseTime: dbResponseTime,
    };
  } catch (error: any) {
    healthStatus.checks.database = {
      status: 'error',
      error: error.message,
      responseTime: 0,
    };
    healthStatus.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };

  healthStatus.checks.memory = {
    status: memoryMB.heapUsed < 512 ? 'ok' : 'warning',
    usage: memoryMB,
  };

  // Total response time
  healthStatus.responseTime = Date.now() - startCheck;

  // Determine overall status
  if (healthStatus.checks.database.status === 'error') {
    healthStatus.status = 'unhealthy';
    res.status(503);
  } else if (
    healthStatus.checks.database.status === 'slow' ||
    healthStatus.checks.memory.status === 'warning'
  ) {
    healthStatus.status = 'degraded';
  }

  res.json(healthStatus);
});

/**
 * Liveness probe - simple check to verify server is running
 * GET /health/live
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

/**
 * Readiness probe - checks if server is ready to accept traffic
 * GET /health/ready
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await query('SELECT 1');
    res.status(200).send('READY');
  } catch (error) {
    res.status(503).send('NOT READY');
  }
});

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
