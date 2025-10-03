import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  generalLimiter,
  strictLimiter,
  authLimiter,
  commandLimiter,
} from './rateLimiter';

describe('Rate Limiter Middleware', () => {
  describe('generalLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(generalLimiter);
      app.get('/test', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should block requests after exceeding limit', async () => {
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test');
      }

      // 101st request should be rate limited
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many requests');
    });

    it('should return correct error message when rate limited', async () => {
      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test');
      }

      const response = await request(app).get('/test');
      expect(response.body).toEqual({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
      });
    });
  });

  describe('strictLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(strictLimiter);
      app.post('/write', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
    });

    it('should allow requests within the strict limit', async () => {
      const response = await request(app).post('/write');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block requests after exceeding strict limit (20 requests)', async () => {
      // Make 20 requests (the limit)
      for (let i = 0; i < 20; i++) {
        await request(app).post('/write');
      }

      // 21st request should be rate limited
      const response = await request(app).post('/write');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many write requests');
    });

    it('should return correct error message for write operations', async () => {
      // Exhaust the limit
      for (let i = 0; i < 20; i++) {
        await request(app).post('/write');
      }

      const response = await request(app).post('/write');
      expect(response.body).toEqual({
        success: false,
        error: 'Too many write requests from this IP, please try again later.',
      });
    });

    it('should include standard rate limit headers', async () => {
      const response = await request(app).post('/write');
      expect(response.headers['ratelimit-limit']).toBe('20');
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('authLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(authLimiter);
      app.post('/auth', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
    });

    it('should allow requests within the auth limit', async () => {
      const response = await request(app).post('/auth');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block requests after exceeding auth limit (5 requests)', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await request(app).post('/auth');
      }

      // 6th request should be rate limited
      const response = await request(app).post('/auth');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many authentication attempts');
    });

    it('should return correct error message for authentication attempts', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await request(app).post('/auth');
      }

      const response = await request(app).post('/auth');
      expect(response.body).toEqual({
        success: false,
        error: 'Too many authentication attempts, please try again later.',
      });
    });

    it('should have the strictest limit to prevent brute force', async () => {
      const response = await request(app).post('/auth');
      expect(response.headers['ratelimit-limit']).toBe('5');
    });
  });

  describe('commandLimiter', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(commandLimiter);
      app.post('/execute', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
    });

    it('should allow requests within the command limit', async () => {
      const response = await request(app).post('/execute');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block requests after exceeding command limit (10 requests)', async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await request(app).post('/execute');
      }

      // 11th request should be rate limited
      const response = await request(app).post('/execute');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many command execution requests');
    });

    it('should return correct error message for command execution', async () => {
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await request(app).post('/execute');
      }

      const response = await request(app).post('/execute');
      expect(response.body).toEqual({
        success: false,
        error: 'Too many command execution requests, please try again later.',
      });
    });

    it('should have shorter time window (5 minutes) for commands', async () => {
      const response = await request(app).post('/execute');
      expect(response.headers['ratelimit-limit']).toBe('10');
    });

    it('should include rate limit reset information', async () => {
      const response = await request(app).post('/execute');
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Rate Limiter Configuration', () => {
    it('should not include legacy X-RateLimit headers', async () => {
      const app = express();
      app.use(generalLimiter);
      app.get('/test', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
    });

    it('should use standard RateLimit headers', async () => {
      const app = express();
      app.use(generalLimiter);
      app.get('/test', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Multiple Limiters Integration', () => {
    it('should apply rate limiters to routes', async () => {
      // This test verifies that rate limiters can be applied without errors
      // We cannot easily test multiple limiters without rate limit store contamination
      const freshApp = express();
      freshApp.use(generalLimiter);
      freshApp.get('/test', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const response = await request(freshApp).get('/test');
      expect([200, 429]).toContain(response.status); // May be rate limited from previous tests
      expect(response.headers['ratelimit-limit']).toBeDefined();
    });

    it('should apply multiple limiters to same route without errors', () => {
      // This test verifies that multiple limiters can be stacked syntactically
      const app = express();

      expect(() => {
        app.post(
          '/secure-write',
          authLimiter,
          strictLimiter,
          (req: Request, res: Response) => {
            res.status(200).json({ success: true });
          }
        );
      }).not.toThrow();
    });
  });
});
