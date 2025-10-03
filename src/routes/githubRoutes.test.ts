import request from 'supertest';
import express, { Application } from 'express';
import githubRoutes from './githubRoutes';
import { githubService } from '../services/githubService';

jest.mock('../services/githubService');
jest.mock('../middleware/rateLimiter', () => ({
  rateLimiter: (req: any, res: any, next: any) => next(),
}));

const mockGithubService = githubService as jest.Mocked<typeof githubService>;

describe('GitHub Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', githubRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/swarms/:swarm_id/github/activity', () => {
    it('should return GitHub activity for a swarm', async () => {
      const mockActivity = [
        {
          id: 'commit-1',
          swarm_id: 'swarm-123',
          event_type: 'commit',
          repository: 'owner/repo',
          actor: 'testuser',
          title: 'Test commit',
          url: 'https://github.com/owner/repo/commit/abc123',
          timestamp: new Date(),
          metadata: { sha: 'abc123' },
        },
      ];

      mockGithubService.getActivity.mockResolvedValue(mockActivity as any);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/github/activity')
        .query({ owner: 'owner', repo: 'repo' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 400 when owner is missing', async () => {
      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/github/activity')
        .query({ repo: 'repo' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/github/metrics', () => {
    it('should return GitHub metrics for a swarm', async () => {
      const mockMetrics = {
        swarm_id: 'swarm-123',
        repository: 'owner/repo',
        commits_count: 100,
        open_prs_count: 5,
        last_updated: new Date(),
      };

      mockGithubService.getMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/github/metrics')
        .query({ owner: 'owner', repo: 'repo' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/github/webhook', () => {
    it('should accept and process webhook', async () => {
      mockGithubService.processWebhook.mockResolvedValue();

      const payload = {
        repository: {
          owner: { login: 'owner' },
          name: 'repo',
          full_name: 'owner/repo',
        },
        sender: { login: 'testuser' },
      };

      const response = await request(app)
        .post('/api/v1/github/webhook')
        .set('X-GitHub-Event', 'push')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when X-GitHub-Event header is missing', async () => {
      const response = await request(app)
        .post('/api/v1/github/webhook')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
