import request from 'supertest';
import express, { Application } from 'express';
import healthRoutes from './healthRoutes';
import * as db from '../database/db';

// Mock the database module
jest.mock('../database/db');

describe('Health Routes', () => {
  let app: Application;
  const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

  beforeEach(() => {
    app = express();
    app.use(healthRoutes);
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'QiFlow Control Center API');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /health/detailed', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
    });

    it('should return detailed health status with all checks', async () => {
      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'QiFlow Control Center API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('responseTime');
    });

    it('should include uptime information', async () => {
      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.uptime).toHaveProperty('seconds');
      expect(response.body.uptime).toHaveProperty('human');
      expect(typeof response.body.uptime.seconds).toBe('number');
      expect(typeof response.body.uptime.human).toBe('string');
    });

    it('should include database check with ok status', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.checks.database).toHaveProperty('status', 'ok');
      expect(response.body.checks.database).toHaveProperty('responseTime');
      expect(typeof response.body.checks.database.responseTime).toBe('number');
    });

    it('should mark database as slow if response time > 1000ms', async () => {
      // Mock a slow database response
      mockQuery.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  rows: [{ health_check: 1 }],
                  rowCount: 1,
                  command: 'SELECT',
                  oid: 0,
                  fields: [],
                }),
              1100
            );
          })
      );

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.checks.database.status).toBe('slow');
      expect(response.body.status).toBe('degraded');
    });

    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('error');
      expect(response.body.checks.database).toHaveProperty('error', 'Connection refused');
    });

    it('should include memory usage information', async () => {
      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.checks.memory).toHaveProperty('status');
      expect(response.body.checks.memory).toHaveProperty('usage');
      expect(response.body.checks.memory.usage).toHaveProperty('rss');
      expect(response.body.checks.memory.usage).toHaveProperty('heapTotal');
      expect(response.body.checks.memory.usage).toHaveProperty('heapUsed');
      expect(response.body.checks.memory.usage).toHaveProperty('external');
    });

    it('should include process information', async () => {
      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.checks.process).toHaveProperty('status', 'ok');
      expect(response.body.checks.process).toHaveProperty('pid');
      expect(response.body.checks.process.pid).toBe(process.pid);
    });

    it('should return overall status ok when all checks pass', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should call database query for health check', async () => {
      await request(app).get('/health/detailed');

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 as health_check');
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 OK for liveness probe', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('should not check database for liveness probe', async () => {
      await request(app).get('/health/live');

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 READY when database is accessible', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ result: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.text).toBe('READY');
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return 503 NOT READY when database is not accessible', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection error'));

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.text).toBe('NOT READY');
    });

    it('should check database connectivity', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ result: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await request(app).get('/health/ready');

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });
  });

  describe('Uptime Formatting', () => {
    it('should format uptime correctly for different durations', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.uptime.human).toMatch(/^\d+[smhd](\s\d+[smhd])*$/);
    });
  });

  describe('Response Time', () => {
    it('should include response time in detailed health check', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('responseTime');
      expect(typeof response.body.responseTime).toBe('number');
      expect(response.body.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database timeout gracefully', async () => {
      mockQuery.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), 100);
          })
      );

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('error');
    });

    it('should return degraded status when database is slow', async () => {
      mockQuery.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  rows: [{ health_check: 1 }],
                  rowCount: 1,
                  command: 'SELECT',
                  oid: 0,
                  fields: [],
                }),
              1500
            );
          })
      );

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.database.status).toBe('slow');
    });
  });

  describe('Version Information', () => {
    it('should include version from environment or default to 1.0.0', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.version).toBe('string');
    });
  });
});
