import request from 'supertest';
import express, { Application } from 'express';
import batchOperationsRoutes from './batchOperationsRoutes';
import { BatchOperationsService } from '../services/batchOperationsService';

jest.mock('../services/batchOperationsService');

describe('Batch Operations Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', batchOperationsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/batch/execute', () => {
    it('should execute batch operation', async () => {
      const mockResult = {
        batch_id: 'batch-123',
        action: 'pause',
        total_swarms: 2,
        successful: 2,
        failed: 0,
        in_progress: 0,
        results: [],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed' as const,
      };

      (BatchOperationsService.executeBatchOperation as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/batch/execute')
        .send({
          action: 'pause',
          swarm_ids: ['swarm-1', 'swarm-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_id).toBe('batch-123');
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app)
        .post('/api/v1/batch/execute')
        .send({
          swarm_ids: ['swarm-1'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('action');
    });

    it('should return 400 for invalid swarm_ids', async () => {
      const response = await request(app)
        .post('/api/v1/batch/execute')
        .send({
          action: 'pause',
          swarm_ids: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('swarm_ids');
    });

    it('should return 400 for invalid action', async () => {
      const response = await request(app)
        .post('/api/v1/batch/execute')
        .send({
          action: 'invalid_action',
          swarm_ids: ['swarm-1'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid action');
    });
  });

  describe('GET /api/v1/batch/:batch_id', () => {
    it('should get batch result', async () => {
      const mockResult = {
        batch_id: 'batch-123',
        action: 'pause',
        total_swarms: 2,
        successful: 2,
        failed: 0,
        in_progress: 0,
        results: [],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed' as const,
      };

      (BatchOperationsService.getBatchResult as jest.Mock).mockReturnValue(mockResult);

      const response = await request(app).get('/api/v1/batch/batch-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_id).toBe('batch-123');
    });

    it('should return 404 for non-existent batch', async () => {
      (BatchOperationsService.getBatchResult as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/v1/batch/invalid');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/v1/groups', () => {
    it('should create a group', async () => {
      const mockGroup = {
        group_id: 'group-123',
        name: 'Test Group',
        description: 'Test description',
        swarm_ids: ['swarm-1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (BatchOperationsService.createGroup as jest.Mock).mockResolvedValue(mockGroup);

      const response = await request(app)
        .post('/api/v1/groups')
        .send({
          name: 'Test Group',
          description: 'Test description',
          swarm_ids: ['swarm-1'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.group_id).toBe('group-123');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });
  });

  describe('GET /api/v1/groups', () => {
    it('should get all groups', async () => {
      const mockGroups = [
        {
          group_id: 'group-1',
          name: 'Group 1',
          swarm_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      (BatchOperationsService.getAllGroups as jest.Mock).mockReturnValue(mockGroups);

      const response = await request(app).get('/api/v1/groups');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('PUT /api/v1/groups/:group_id', () => {
    it('should update a group', async () => {
      const mockGroup = {
        group_id: 'group-123',
        name: 'Updated Group',
        swarm_ids: ['swarm-1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (BatchOperationsService.updateGroup as jest.Mock).mockResolvedValue(mockGroup);

      const response = await request(app)
        .put('/api/v1/groups/group-123')
        .send({
          name: 'Updated Group',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Group');
    });

    it('should return 404 for non-existent group', async () => {
      (BatchOperationsService.updateGroup as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/groups/invalid')
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/v1/groups/:group_id', () => {
    it('should delete a group', async () => {
      (BatchOperationsService.deleteGroup as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/v1/groups/group-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent group', async () => {
      (BatchOperationsService.deleteGroup as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/v1/groups/invalid');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/v1/groups/:group_id/execute', () => {
    it('should execute batch operation on group', async () => {
      const mockResult = {
        batch_id: 'batch-123',
        action: 'pause',
        total_swarms: 2,
        successful: 2,
        failed: 0,
        in_progress: 0,
        results: [],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed' as const,
      };

      (BatchOperationsService.executeBatchOperationOnGroup as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/groups/group-123/execute')
        .send({
          action: 'pause',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_id).toBe('batch-123');
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app)
        .post('/api/v1/groups/group-123/execute')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('action');
    });
  });
});
