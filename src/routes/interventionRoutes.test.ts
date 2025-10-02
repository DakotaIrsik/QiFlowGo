import request from 'supertest';
import express, { Application } from 'express';
import interventionRoutes from './interventionRoutes';
import { InterventionFlagModel } from '../models/InterventionFlagModel';

// Mock the model
jest.mock('../models/InterventionFlagModel');

describe('Intervention Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', interventionRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/swarms/:swarm_id/interventions', () => {
    it('should return all flags for a swarm', async () => {
      const mockFlags = [
        {
          id: 1,
          swarm_id: 'swarm-1',
          issue_number: 123,
          priority: 'critical',
          reason: 'Test',
          trigger_type: 'manual',
          flagged_at: new Date(),
        },
      ];

      (InterventionFlagModel.find as jest.Mock).mockResolvedValue(mockFlags);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/interventions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject([{
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        priority: 'critical',
        reason: 'Test',
        trigger_type: 'manual',
      }]);
      expect(response.body.count).toBe(1);
      expect(InterventionFlagModel.find).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        priority: undefined,
        resolved: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should filter by priority', async () => {
      (InterventionFlagModel.find as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/v1/swarms/swarm-1/interventions?priority=critical')
        .expect(200);

      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'critical',
        })
      );
    });

    it('should filter by resolved status', async () => {
      (InterventionFlagModel.find as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/v1/swarms/swarm-1/interventions?resolved=false')
        .expect(200);

      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          resolved: false,
        })
      );
    });

    it('should apply limit and offset', async () => {
      (InterventionFlagModel.find as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/v1/swarms/swarm-1/interventions?limit=10&offset=20')
        .expect(200);

      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.find as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/interventions')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch intervention flags');
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/interventions/count', () => {
    it('should return flag counts', async () => {
      const mockCount = {
        critical: 5,
        review: 3,
        total: 8,
      };

      (InterventionFlagModel.getCount as jest.Mock).mockResolvedValue(mockCount);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/interventions/count')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCount);
      expect(InterventionFlagModel.getCount).toHaveBeenCalledWith('swarm-1');
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.getCount as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/v1/swarms/swarm-1/interventions/count')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to count intervention flags');
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/issues/:issue_id/flag', () => {
    it('should create a manual flag', async () => {
      const mockFlag = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        priority: 'critical',
        reason: 'Manual intervention needed',
        trigger_type: 'manual',
        flagged_at: new Date(),
      };

      (InterventionFlagModel.create as jest.Mock).mockResolvedValue(mockFlag);

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/issues/123/flag')
        .send({
          priority: 'critical',
          reason: 'Manual intervention needed',
          github_url: 'https://github.com/test/repo/issues/123',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        priority: 'critical',
        reason: 'Manual intervention needed',
        trigger_type: 'manual',
      });
      expect(InterventionFlagModel.create).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Manual intervention needed',
        trigger_type: 'manual',
        metadata: undefined,
      });
    });

    it('should include note in metadata if provided', async () => {
      const mockFlag = { id: 1 };
      (InterventionFlagModel.create as jest.Mock).mockResolvedValue(mockFlag);

      await request(app)
        .post('/api/v1/swarms/swarm-1/issues/123/flag')
        .send({
          priority: 'review',
          reason: 'Needs attention',
          note: 'Check this carefully',
        })
        .expect(201);

      expect(InterventionFlagModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { note: 'Check this carefully' },
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/issues/123/flag')
        .send({
          priority: 'critical',
          // missing reason
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should validate priority values', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/issues/123/flag')
        .send({
          priority: 'invalid',
          reason: 'Test',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid priority');
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/issues/123/flag')
        .send({
          priority: 'critical',
          reason: 'Test',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create intervention flag');
    });
  });

  describe('PUT /api/v1/swarms/:swarm_id/interventions/:flag_id/resolve', () => {
    it('should resolve a flag', async () => {
      const mockFlag = {
        id: 1,
        resolved_at: new Date(),
        resolved_by: 'user123',
        resolution_note: 'Fixed',
      };

      (InterventionFlagModel.resolve as jest.Mock).mockResolvedValue(mockFlag);

      const response = await request(app)
        .put('/api/v1/swarms/swarm-1/interventions/1/resolve')
        .send({
          resolved_by: 'user123',
          resolution_note: 'Fixed',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 1,
        resolved_by: 'user123',
        resolution_note: 'Fixed',
      });
      expect(InterventionFlagModel.resolve).toHaveBeenCalledWith({
        flag_id: 1,
        resolved_by: 'user123',
        resolution_note: 'Fixed',
      });
    });

    it('should validate resolved_by field', async () => {
      const response = await request(app)
        .put('/api/v1/swarms/swarm-1/interventions/1/resolve')
        .send({
          resolution_note: 'Fixed',
          // missing resolved_by
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field: resolved_by');
    });

    it('should return 404 if flag not found', async () => {
      (InterventionFlagModel.resolve as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/swarms/swarm-1/interventions/999/resolve')
        .send({
          resolved_by: 'user123',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Flag not found');
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.resolve as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put('/api/v1/swarms/swarm-1/interventions/1/resolve')
        .send({
          resolved_by: 'user123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to resolve intervention flag');
    });
  });

  describe('DELETE /api/v1/swarms/:swarm_id/issues/:issue_id/flag/:flag_id', () => {
    it('should delete a flag', async () => {
      (InterventionFlagModel.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/swarms/swarm-1/issues/123/flag/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Flag deleted successfully');
      expect(InterventionFlagModel.delete).toHaveBeenCalledWith(1);
    });

    it('should return 404 if flag not found', async () => {
      (InterventionFlagModel.delete as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/swarms/swarm-1/issues/123/flag/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Flag not found');
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .delete('/api/v1/swarms/swarm-1/issues/123/flag/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to delete intervention flag');
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/interventions/bulk-resolve', () => {
    it('should resolve multiple flags', async () => {
      (InterventionFlagModel.bulkResolve as jest.Mock).mockResolvedValue(3);

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/interventions/bulk-resolve')
        .send({
          flag_ids: [1, 2, 3],
          resolved_by: 'user123',
          resolution_note: 'Bulk fixed',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resolved_count).toBe(3);
      expect(InterventionFlagModel.bulkResolve).toHaveBeenCalledWith(
        [1, 2, 3],
        'user123',
        'Bulk fixed'
      );
    });

    it('should validate flag_ids is an array', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/interventions/bulk-resolve')
        .send({
          flag_ids: 'not-an-array',
          resolved_by: 'user123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('invalid field: flag_ids');
    });

    it('should validate flag_ids is not empty', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/interventions/bulk-resolve')
        .send({
          flag_ids: [],
          resolved_by: 'user123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('non-empty array');
    });

    it('should validate resolved_by field', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/interventions/bulk-resolve')
        .send({
          flag_ids: [1, 2, 3],
          // missing resolved_by
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field: resolved_by');
    });

    it('should handle errors gracefully', async () => {
      (InterventionFlagModel.bulkResolve as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/v1/swarms/swarm-1/interventions/bulk-resolve')
        .send({
          flag_ids: [1, 2, 3],
          resolved_by: 'user123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to bulk resolve intervention flags');
    });
  });
});
