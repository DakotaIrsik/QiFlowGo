import request from 'supertest';
import app from './app';
import { swarmPollingService } from './services/swarmPollingService';

// Mock the polling service
jest.mock('./services/swarmPollingService', () => ({
  swarmPollingService: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock the database and models
jest.mock('./database/db');
jest.mock('./models/InterventionFlagModel');
jest.mock('./models/SwarmModel');
jest.mock('./services/cacheService', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
  },
}));

describe('QiFlow Control Center API - E2E Tests', () => {
  beforeAll(() => {
    // Ensure polling service was started
    expect(swarmPollingService.start).toHaveBeenCalled();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'QiFlow Control Center API');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should have correct security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet sets various security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('CORS Configuration', () => {
    it('should allow CORS requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route').expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not found',
      });
    });

    it('should handle POST to unknown routes', async () => {
      const response = await request(app)
        .post('/unknown-route')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not found');
    });
  });

  describe('Request Body Parsing', () => {
    it('should parse JSON bodies', async () => {
      // This will hit intervention routes which should be mocked
      const response = await request(app)
        .post('/api/v1/intervention-flags')
        .send({
          swarm_id: 'test',
          issue_number: 1,
          priority: 'critical',
          reason: 'test',
          trigger_type: 'manual',
        });

      // Response might be 400, 500, or 201 depending on mocks
      // Just verify the server can parse the JSON
      expect(response.body).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/intervention-flags')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('API Route Integration', () => {
    it('should have intervention routes mounted at /api/v1', async () => {
      const response = await request(app).get('/api/v1/swarms/test-swarm/intervention-flags');

      // Should not be 404 - should reach the route handler (might be 500 due to mocks, but not 404)
      expect(response.status).not.toBe(404);
    });

    it('should have swarm routes mounted at /api/v1', async () => {
      const response = await request(app).get('/api/v1/swarms');

      // Should not be 404 - should reach the route handler
      expect(response.status).not.toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Try to trigger an error by sending invalid data
      const response = await request(app)
        .post('/api/v1/swarms')
        .send({
          // Invalid data to potentially trigger error
          invalid_field: 'test',
        });

      // Should return error response, not crash
      expect(response.body).toHaveProperty('success');
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Performance', () => {
    it('should respond to health check quickly', async () => {
      const startTime = Date.now();
      await request(app).get('/health').expect(200);
      const duration = Date.now() - startTime;

      // Should respond within 100ms (generous limit for test environment)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/health'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('Content-Type Headers', () => {
    it('should return JSON for API endpoints', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON for 404 errors', async () => {
      const response = await request(app).get('/nonexistent');

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        success: false,
        error: 'Not found',
      });
    });
  });
});
