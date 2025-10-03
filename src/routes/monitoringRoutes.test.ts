import request from 'supertest';
import app from '../app';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';

jest.mock('../models/SwarmModel');
jest.mock('../services/notificationService');

describe('Monitoring API Endpoints', () => {
  const API_KEY = process.env.API_KEY_SECRET || 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
  });

  describe('POST /api/v1/heartbeat', () => {
    it('should accept valid heartbeat and update swarm status', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {
          cpu_percent: 45.5,
          memory_percent: 60.2,
          disk_percent: 30.1,
        },
        active_agents: 5,
        project_completion: 75,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'test-swarm-1',
          status: 'online',
          health_status: {
            cpu_percent: 45.5,
            memory_percent: 60.2,
            disk_percent: 30.1,
          },
          active_agents: 5,
          project_completion: 75,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Heartbeat received');
      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'test-swarm-1',
        status: 'online',
        health_status: {
          cpu_percent: 45.5,
          memory_percent: 60.2,
          disk_percent: 30.1,
        },
        active_agents: 5,
        project_completion: 75,
      });
    });

    it('should reject heartbeat without swarm_id', async () => {
      const response = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          status: 'online',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field: swarm_id');
    });

    it('should reject heartbeat for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'non-existent-swarm',
          status: 'online',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Swarm not found');
    });

    it('should reject heartbeat with invalid health_status format', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'test-swarm-1',
          health_status: {
            cpu_percent: 'invalid',
            memory_percent: 60,
            disk_percent: 30,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid health_status format');
    });

    it('should default status to online if not provided', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'test-swarm-1',
        });

      expect(response.status).toBe(200);
      expect(SwarmModel.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          swarm_id: 'test-swarm-1',
          status: 'online',
        })
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/heartbeat')
        .send({
          swarm_id: 'test-swarm-1',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should invalidate cache after heartbeat', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue(mockSwarm);

      // Set cache first
      cache.set('swarms:all', [mockSwarm]);
      cache.set('swarm:test-swarm-1', mockSwarm);

      await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'test-swarm-1',
          status: 'online',
        });

      // Cache should be invalidated
      expect(cache.get('swarms:all')).toBeUndefined();
      expect(cache.get('swarm:test-swarm-1')).toBeUndefined();
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/control', () => {
    it('should accept valid control action', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          action: 'restart',
          parameters: { timeout: 30 },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('restart');
      expect(response.body.data.action).toBe('restart');
      expect(response.body.data.status).toBe('queued');
    });

    it('should reject control action without action field', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          parameters: { timeout: 30 },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field: action');
    });

    it('should reject invalid control actions', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          action: 'invalid-action',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid action');
    });

    it('should accept all valid control actions', async () => {
      const mockSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {},
        active_agents: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const validActions = ['start', 'stop', 'restart', 'update', 'config'];

      for (const action of validActions) {
        const response = await request(app)
          .post('/api/v1/swarms/test-swarm-1/control')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ action });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.action).toBe(action);
      }
    });

    it('should return 404 for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/swarms/non-existent/control')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          action: 'restart',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Swarm not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm-1/control')
        .send({
          action: 'restart',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration - Heartbeat and Control Flow', () => {
    it('should handle complete monitoring workflow', async () => {
      const mockSwarm = {
        swarm_id: 'workflow-test',
        name: 'Workflow Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'online',
        last_seen: new Date(),
        health_status: {
          cpu_percent: 30,
          memory_percent: 50,
          disk_percent: 25,
        },
        active_agents: 3,
        project_completion: 50,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue(mockSwarm);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([mockSwarm]);

      // 1. Send heartbeat
      const heartbeatResponse = await request(app)
        .post('/api/v1/heartbeat')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          swarm_id: 'workflow-test',
          status: 'online',
          health_status: {
            cpu_percent: 30,
            memory_percent: 50,
            disk_percent: 25,
          },
          active_agents: 3,
          project_completion: 50,
        });

      expect(heartbeatResponse.status).toBe(200);

      // 2. Get swarm list
      const listResponse = await request(app)
        .get('/api/v1/swarms')
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);

      // 3. Send control action
      const controlResponse = await request(app)
        .post('/api/v1/swarms/workflow-test/control')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          action: 'restart',
        });

      expect(controlResponse.status).toBe(200);
      expect(controlResponse.body.data.status).toBe('queued');
    });
  });
});
