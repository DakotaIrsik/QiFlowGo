import request from 'supertest';
import express, { Application } from 'express';
import swarmRoutes from './swarmRoutes';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';
import { ProjectCompletionService } from '../services/projectCompletionService';
import { SwarmControlService } from '../services/swarmControlService';

// Mock the model and cache
jest.mock('../models/SwarmModel');
jest.mock('../services/cacheService', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
  },
}));
jest.mock('../services/projectCompletionService');
jest.mock('../services/swarmControlService');

describe('Swarm Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', swarmRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/swarms', () => {
    it('should return cached data if available', async () => {
      const mockSwarms = [
        {
          swarm_id: 'swarm-1',
          name: 'Test Swarm',
          status: 'online',
          last_seen: '2025-10-02T23:00:00.000Z',
        },
      ];

      (cache.get as jest.Mock).mockReturnValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarms);
      expect(response.body.cached).toBe(true);
      expect(SwarmModel.findAll).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not cached', async () => {
      const mockSwarms = [
        {
          swarm_id: 'swarm-1',
          name: 'Test Swarm',
          status: 'online',
          last_seen: new Date('2025-10-02T23:00:00.000Z'),
        },
      ];

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject([
        {
          swarm_id: 'swarm-1',
          name: 'Test Swarm',
          status: 'online',
        },
      ]);
      expect(response.body.cached).toBe(false);
      expect(SwarmModel.findAll).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith('swarms:all', mockSwarms, 30000);
    });

    it('should filter by status', async () => {
      const mockSwarms = [
        { swarm_id: '1', name: 'Swarm 1', status: 'online', last_seen: new Date() },
        { swarm_id: '2', name: 'Swarm 2', status: 'offline', last_seen: new Date() },
        { swarm_id: '3', name: 'Swarm 3', status: 'online', last_seen: new Date() },
      ];

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms?status=online').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((s: any) => s.status === 'online')).toBe(true);
    });

    it('should filter by search term', async () => {
      const mockSwarms = [
        { swarm_id: 'prod-1', name: 'Production Swarm', status: 'online', last_seen: new Date() },
        { swarm_id: 'dev-1', name: 'Dev Swarm', status: 'online', last_seen: new Date() },
        { swarm_id: 'prod-2', name: 'Prod Backend', status: 'online', last_seen: new Date() },
      ];

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms?search=prod').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/v1/swarms').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch swarms');
    });
  });

  describe('GET /api/v1/swarms/stats/aggregate', () => {
    it('should return aggregate stats', async () => {
      const mockSwarms = [
        {
          swarm_id: '1',
          name: 'Swarm 1',
          status: 'online',
          active_agents: 3,
          project_completion: 80,
          health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
          last_seen: new Date(),
        },
        {
          swarm_id: '2',
          name: 'Swarm 2',
          status: 'offline',
          active_agents: 0,
          project_completion: 50,
          health_status: { cpu_percent: 20, memory_percent: 30, disk_percent: 40 },
          last_seen: new Date(),
        },
        {
          swarm_id: '3',
          name: 'Swarm 3',
          status: 'online',
          active_agents: 5,
          project_completion: 90,
          health_status: { cpu_percent: 95, memory_percent: 92, disk_percent: 88 },
          last_seen: new Date(),
        },
      ];

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms/stats/aggregate').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total_swarms: 3,
        swarms_running: 2,
        swarms_offline: 1,
        swarms_degraded: 0,
        total_active_agents: 8,
        avg_project_completion: (80 + 50 + 90) / 3,
        alerts_count: 1, // Only swarm 3 has high resource usage
      });
    });

    it('should return cached aggregate stats', async () => {
      const cachedStats = {
        total_swarms: 5,
        swarms_running: 4,
        swarms_offline: 1,
      };

      (cache.get as jest.Mock).mockReturnValue(cachedStats);

      const response = await request(app).get('/api/v1/swarms/stats/aggregate').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(cachedStats);
      expect(response.body.cached).toBe(true);
      expect(SwarmModel.findAll).not.toHaveBeenCalled();
    });

    it('should handle empty swarm list', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/v1/swarms/stats/aggregate').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total_swarms: 0,
        swarms_running: 0,
        swarms_offline: 0,
        swarms_degraded: 0,
        total_active_agents: 0,
        avg_project_completion: 0,
        alerts_count: 0,
      });
    });
  });

  describe('GET /api/v1/swarms/:swarm_id', () => {
    it('should return cached swarm if available', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
      };

      (cache.get as jest.Mock).mockReturnValue(mockSwarm);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarm);
      expect(response.body.cached).toBe(true);
      expect(cache.get).toHaveBeenCalledWith('swarm:swarm-1');
    });

    it('should fetch from database if not cached', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
      };

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarm);
      expect(response.body.cached).toBe(false);
      expect(SwarmModel.findById).toHaveBeenCalledWith('swarm-1');
      expect(cache.set).toHaveBeenCalledWith('swarm:swarm-1', mockSwarm, 15000);
    });

    it('should return 404 if swarm not found', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });

    it('should handle database errors', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch swarm');
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/status', () => {
    it('should return cached status if available', async () => {
      const cachedStatus = {
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
      };

      (cache.get as jest.Mock).mockReturnValue(cachedStatus);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(cachedStatus);
      expect(response.body.cached).toBe(true);
      expect(SwarmModel.findById).not.toHaveBeenCalled();
    });

    it('should return lightweight status', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
        last_seen: new Date(),
        health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        active_agents: 5,
        project_completion: 75,
      };

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: mockSwarm.health_status,
        active_agents: 5,
      });
      expect(response.body.data).not.toHaveProperty('name');
      expect(response.body.data).not.toHaveProperty('project_completion');
    });

    it('should return 404 if swarm not found', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/nonexistent/status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('POST /api/v1/swarms', () => {
    it('should create a new swarm', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8080',
        status: 'offline',
      };

      (SwarmModel.create as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/swarms')
        .send({
          swarm_id: 'swarm-1',
          name: 'Test Swarm',
          host_url: 'http://localhost:8080',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarm);
      expect(SwarmModel.create).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8080',
      });
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarms:');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/swarms')
        .send({
          swarm_id: 'swarm-1',
          // missing name and host_url
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/v1/swarms')
        .send({
          swarm_id: 'swarm-1',
          name: 'Test',
          host_url: 'not-a-valid-url',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid host_url format');
    });

    it('should handle duplicate swarm ID', async () => {
      const error: any = new Error('Duplicate key');
      error.code = '23505';
      (SwarmModel.create as jest.Mock).mockRejectedValue(error);

      const response = await request(app)
        .post('/api/v1/swarms')
        .send({
          swarm_id: 'swarm-1',
          name: 'Test',
          host_url: 'http://localhost:8080',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/v1/swarms/:swarm_id', () => {
    it('should delete a swarm', async () => {
      (SwarmModel.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/swarms/swarm-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Swarm deleted successfully');
      expect(SwarmModel.delete).toHaveBeenCalledWith('swarm-1');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarms:');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:swarm-1');
    });

    it('should return 404 if swarm not found', async () => {
      (SwarmModel.delete as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/swarms/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('POST /api/v1/swarms/refresh', () => {
    it('should invalidate cache', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/refresh')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cache invalidated');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarms:');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:');
    });
  });

  describe('POST /api/v1/heartbeat', () => {
    it('should process heartbeat from existing swarm', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
      };

      const updatedSwarm = {
        ...mockSwarm,
        status: 'online',
        health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        active_agents: 5,
        project_completion: 75,
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue(updatedSwarm);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'swarm-1',
          status: 'online',
          health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
          active_agents: 5,
          project_completion: 75,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Heartbeat received');
      expect(response.body.data).toEqual(updatedSwarm);
      expect(SwarmModel.findById).toHaveBeenCalledWith('swarm-1');
      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        active_agents: 5,
        project_completion: 75,
      });
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarms:');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:swarm-1');
    });

    it('should validate required swarm_id field', async () => {
      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          status: 'online',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required field: swarm_id');
      expect(SwarmModel.findById).not.toHaveBeenCalled();
    });

    it('should return 404 if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'nonexistent',
          status: 'online',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found. Please register the swarm first.');
    });

    it('should validate health_status format', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'swarm-1',
          status: 'online',
          health_status: { cpu_percent: 'invalid', memory_percent: 60, disk_percent: 30 },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid health_status format');
      expect(SwarmModel.updateStatus).not.toHaveBeenCalled();
    });

    it('should use default status if not provided', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'offline',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({ ...mockSwarm, status: 'online' });

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'swarm-1',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: undefined,
        active_agents: undefined,
        project_completion: undefined,
      });
    });

    it('should handle database errors', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue({ swarm_id: 'swarm-1' });
      (SwarmModel.updateStatus as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'swarm-1',
          status: 'online',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to process heartbeat');
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/control', () => {
    it('should queue control action for swarm', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        status: 'online',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/control')
        .send({
          action: 'restart',
          parameters: { delay: 5 },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Control action 'restart' queued for swarm swarm-1");
      expect(response.body.data).toMatchObject({
        swarm_id: 'swarm-1',
        action: 'restart',
        parameters: { delay: 5 },
        status: 'queued',
      });
      expect(response.body.data.queued_at).toBeDefined();
      expect(SwarmModel.findById).toHaveBeenCalledWith('swarm-1');
    });

    it('should validate required action field', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/control')
        .send({
          parameters: {},
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required field: action');
      expect(SwarmModel.findById).not.toHaveBeenCalled();
    });

    it('should validate action is in allowed list', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/control')
        .send({
          action: 'invalid_action',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid action');
      expect(response.body.error).toContain('start, stop, restart, update, config');
    });

    it('should return 404 if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/swarms/nonexistent/control')
        .send({
          action: 'start',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });

    it('should accept all valid control actions', async () => {
      const mockSwarm = { swarm_id: 'swarm-1', name: 'Test', status: 'online' };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const validActions = ['start', 'stop', 'restart', 'update', 'config'];

      for (const action of validActions) {
        const response = await request(app)
          .post('/api/v1/swarms/swarm-1/control')
          .send({ action })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.action).toBe(action);
      }
    });

    it('should handle database errors', async () => {
      (SwarmModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/control')
        .send({
          action: 'restart',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to execute control action');
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/project/completion', () => {
    it('should return project completion data successfully', async () => {
      const mockSwarm = { swarm_id: 'swarm-1', name: 'Test Swarm', status: 'online' };
      const mockCompletionData = {
        completion_percentage: 73,
        total_issues: 68,
        completed_issues: 45,
        in_progress_issues: 8,
        ready_issues: 12,
        blocked_issues: 3,
        issues_requiring_human_intervention: [
          {
            issue_number: 127,
            title: 'Merge conflict in auth module',
            priority: 'critical',
            blocked_duration_hours: 48,
            agent_message: 'Unable to resolve conflict',
            github_url: 'https://github.com/owner/repo/issues/127',
          },
        ],
        velocity_trend: {
          issues_per_day: 6.2,
          last_7_days: [5, 8, 7, 6, 4, 9, 7],
          trend: 'stable',
        },
        estimated_completion_date: '2025-11-15',
        confidence_level: 0.95,
      };

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (ProjectCompletionService.getProjectCompletion as jest.Mock).mockResolvedValue(mockCompletionData);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_owner: 'owner', github_repo: 'repo' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCompletionData);
      expect(response.body.cached).toBe(false);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should return cached data if available', async () => {
      const mockCompletionData = {
        completion_percentage: 73,
        total_issues: 68,
        completed_issues: 45,
      };

      (cache.get as jest.Mock).mockReturnValue(mockCompletionData);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_owner: 'owner', github_repo: 'repo' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCompletionData);
      expect(response.body.cached).toBe(true);
      expect(SwarmModel.findById).not.toHaveBeenCalled();
    });

    it('should return 400 if github_owner is missing', async () => {
      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_repo: 'repo' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required query parameters: github_owner, github_repo');
    });

    it('should return 400 if github_repo is missing', async () => {
      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_owner: 'owner' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required query parameters: github_owner, github_repo');
    });

    it('should return 404 if swarm not found', async () => {
      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/nonexistent/project/completion')
        .query({ github_owner: 'owner', github_repo: 'repo' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });

    it('should handle service errors gracefully', async () => {
      const mockSwarm = { swarm_id: 'swarm-1', name: 'Test', status: 'online' };

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (ProjectCompletionService.getProjectCompletion as jest.Mock).mockRejectedValue(
        new Error('GitHub API rate limit exceeded')
      );

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_owner: 'owner', github_repo: 'repo' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('GitHub API rate limit exceeded');
    });

    it('should pass github_token to service if provided', async () => {
      const mockSwarm = { swarm_id: 'swarm-1', name: 'Test', status: 'online' };
      const mockData = { completion_percentage: 50, total_issues: 10, completed_issues: 5 };

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (ProjectCompletionService.getProjectCompletion as jest.Mock).mockResolvedValue(mockData);

      await request(app)
        .get('/api/v1/swarms/swarm-1/project/completion')
        .query({ github_owner: 'owner', github_repo: 'repo', github_token: 'secret-token' })
        .expect(200);

      expect(ProjectCompletionService.getProjectCompletion).toHaveBeenCalledWith(
        'swarm-1',
        'owner',
        'repo',
        'secret-token'
      );
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/control', () => {
    const mockSwarm = { swarm_id: 'test-swarm-1', name: 'Test Swarm', status: 'online' };

    beforeEach(() => {
      (SwarmControlService.validateControlAction as jest.Mock).mockResolvedValue({ valid: true });
    });

    it('should pause a swarm', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'pause',
        status: 'queued',
        message: 'Pause command queued',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.pauseSwarm as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'pause' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(SwarmControlService.validateControlAction).toHaveBeenCalledWith('test-swarm-1', 'pause');
      expect(SwarmControlService.pauseSwarm).toHaveBeenCalledWith('test-swarm-1');
    });

    it('should resume a swarm', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'resume',
        status: 'queued',
        message: 'Resume command queued',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.resumeSwarm as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'resume' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(SwarmControlService.resumeSwarm).toHaveBeenCalledWith('test-swarm-1');
    });

    it('should restart a specific agent', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'restart_agent',
        status: 'queued',
        message: 'Restart agent-123',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.restartAgent as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'restart_agent', parameters: { agent_id: 'agent-123' } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmControlService.restartAgent).toHaveBeenCalledWith('test-swarm-1', 'agent-123');
    });

    it('should force sync', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'force_sync',
        status: 'queued',
        message: 'Force sync queued',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.forceSync as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'force_sync' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmControlService.forceSync).toHaveBeenCalledWith('test-swarm-1');
    });

    it('should perform emergency stop', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'emergency_stop',
        status: 'queued',
        message: 'EMERGENCY STOP queued',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.emergencyStop as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'emergency_stop', parameters: { reason: 'Critical bug' } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmControlService.emergencyStop).toHaveBeenCalledWith('test-swarm-1', 'Critical bug');
    });

    it('should trigger manual processing', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'manual_trigger',
        status: 'queued',
        message: 'Manual trigger queued',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.manualTrigger as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'manual_trigger' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmControlService.manualTrigger).toHaveBeenCalledWith('test-swarm-1');
    });

    it('should apply schedule preset', async () => {
      const mockResult = {
        swarm_id: 'test-swarm-1',
        action: 'apply_schedule_preset',
        status: 'queued',
        message: 'Schedule preset applied',
        queued_at: new Date().toISOString(),
      };

      (SwarmControlService.applySchedulePreset as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'apply_schedule_preset', parameters: { preset_name: 'Always Active' } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(SwarmControlService.applySchedulePreset).toHaveBeenCalledWith(
        'test-swarm-1',
        'Always Active'
      );
    });

    it('should return 400 if action is missing', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required field: action');
    });

    it('should return 400 for invalid action', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'invalid_action' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid action');
    });

    it('should return 400 if validation fails', async () => {
      (SwarmControlService.validateControlAction as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Cannot pause an offline swarm',
      });

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'pause' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot pause an offline swarm');
    });

    it('should return 400 if preset_name is missing for apply_schedule_preset', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({ action: 'apply_schedule_preset', parameters: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required parameter: preset_name');
    });

    it('should handle service errors gracefully', async () => {
      (SwarmControlService.pauseSwarm as jest.Mock).mockRejectedValue(new Error('Swarm not found'));

      const response = await request(app)
        .post('/api/v1/swarms/nonexistent/control')
        .send({ action: 'pause' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('GET /api/v1/swarms/schedule/presets', () => {
    it('should return all schedule presets', async () => {
      const mockPresets = [
        {
          name: 'Always Active',
          cron_expression: '* * * * *',
          timezone: 'UTC',
          description: 'Run continuously',
        },
        {
          name: 'Business Hours',
          cron_expression: '0 9-17 * * 1-5',
          timezone: 'America/New_York',
          description: 'Weekdays 9-5',
        },
      ];

      (SwarmControlService.getSchedulePresets as jest.Mock).mockReturnValue(mockPresets);

      const response = await request(app).get('/api/v1/swarms/schedule/presets').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPresets);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      (SwarmControlService.getSchedulePresets as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to fetch presets');
      });

      const response = await request(app).get('/api/v1/swarms/schedule/presets').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch schedule presets');
    });
  });
});
