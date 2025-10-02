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
          last_seen: new Date(),
        },
      ];

      (cache.get as jest.Mock).mockReturnValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarms);
      expect(response.body.cached).toBe(true);
      expect(cache.get).toHaveBeenCalledWith('swarms:all');
      expect(SwarmModel.findAll).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not cached', async () => {
      const mockSwarms = [
        {
          swarm_id: 'swarm-1',
          name: 'Test Swarm',
          status: 'online',
          last_seen: new Date(),
        },
      ];

      (cache.get as jest.Mock).mockReturnValue(null);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);

      const response = await request(app).get('/api/v1/swarms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSwarms);
      expect(response.body.cached).toBe(false);
      expect(SwarmModel.findAll).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith('swarms:all', mockSwarms, 30000);
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
  });

  describe('GET /api/v1/swarms/:swarm_id/status', () => {
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
});
