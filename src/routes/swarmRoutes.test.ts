import request from 'supertest';
import express, { Application } from 'express';
import swarmRoutes from './swarmRoutes';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';

// Mock the model and cache
jest.mock('../models/SwarmModel');
jest.mock('../services/cacheService', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
  },
}));

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
});
