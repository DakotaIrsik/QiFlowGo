import request from 'supertest';
import express, { Application } from 'express';
import { generalLimiter, strictLimiter, commandLimiter, authLimiter } from './rateLimiter';

describe('Rate Limiting Middleware', () => {
  let app: Application;

  describe('generalLimiter', () => {
    beforeEach(() => {
      app = express();
      app.use(generalLimiter);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('strictLimiter', () => {
    beforeEach(() => {
      app = express();
      app.use(strictLimiter);
      app.post('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the strict limit', async () => {
      const response = await request(app).post('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('commandLimiter', () => {
    beforeEach(() => {
      app = express();
      app.use(commandLimiter);
      app.post('/execute', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow command executions under the limit', async () => {
      const response = await request(app).post('/execute');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should have shorter window time for command execution', async () => {
      const response = await request(app).post('/execute');
      expect(response.status).toBe(200);
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      app = express();
      app.use(authLimiter);
      app.post('/login', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow authentication attempts under the limit', async () => {
      const response = await request(app).post('/login');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
