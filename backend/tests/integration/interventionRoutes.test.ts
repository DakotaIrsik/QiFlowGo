import request from 'supertest';
import app from '../../../src/app';
import { InterventionFlagModel } from '../../../src/models/InterventionFlagModel';
import { NotificationService } from '../../../src/services/notificationService';

// Mock dependencies
jest.mock('../../../src/models/InterventionFlagModel');
jest.mock('../../../src/services/notificationService');

describe('Intervention Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/swarms/:swarm_id/interventions', () => {
    it('should return all intervention flags for a swarm', async () => {
      const mockFlags = [
        {
          id: 1,
          swarm_id: 'test-swarm',
          issue_number: 123,
          priority: 'critical',
          reason: 'Agent failure',
          trigger_type: 'agent_failure',
          flagged_at: new Date(),
        },
        {
          id: 2,
          swarm_id: 'test-swarm',
          issue_number: 456,
          priority: 'review',
          reason: 'Blocked for 30 hours',
          trigger_type: 'blocked_duration',
          flagged_at: new Date(),
        },
      ];

      jest.spyOn(InterventionFlagModel, 'find').mockResolvedValue(mockFlags as any);

      const response = await request(app).get('/api/v1/swarms/test-swarm/interventions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter by priority', async () => {
      jest.spyOn(InterventionFlagModel, 'find').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/swarms/test-swarm/interventions')
        .query({ priority: 'critical' });

      expect(response.status).toBe(200);
      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'critical' })
      );
    });

    it('should filter by resolved status', async () => {
      jest.spyOn(InterventionFlagModel, 'find').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/swarms/test-swarm/interventions')
        .query({ resolved: 'false' });

      expect(response.status).toBe(200);
      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ resolved: false })
      );
    });

    it('should support pagination', async () => {
      jest.spyOn(InterventionFlagModel, 'find').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/swarms/test-swarm/interventions')
        .query({ limit: 10, offset: 20 });

      expect(response.status).toBe(200);
      expect(InterventionFlagModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/interventions/count', () => {
    it('should return count of unresolved flags', async () => {
      const mockCount = { critical: 3, review: 5, total: 8 };
      jest.spyOn(InterventionFlagModel, 'getCount').mockResolvedValue(mockCount);

      const response = await request(app).get('/api/v1/swarms/test-swarm/interventions/count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCount);
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/issues/:issue_id/flag', () => {
    it('should create a manual intervention flag', async () => {
      const mockFlag = {
        id: 1,
        swarm_id: 'test-swarm',
        issue_number: 123,
        priority: 'review',
        reason: 'Manual review requested',
        trigger_type: 'manual',
        flagged_at: new Date(),
      };

      jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue(mockFlag as any);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/issues/123/flag')
        .send({
          priority: 'review',
          reason: 'Manual review requested',
          note: 'Need to check this manually',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(InterventionFlagModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          swarm_id: 'test-swarm',
          issue_number: 123,
          priority: 'review',
          reason: 'Manual review requested',
          trigger_type: 'manual',
        })
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/issues/123/flag')
        .send({ priority: 'review' }); // missing reason

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 if priority is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/issues/123/flag')
        .send({
          priority: 'invalid',
          reason: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid priority');
    });
  });

  describe('PUT /api/v1/swarms/:swarm_id/interventions/:flag_id/resolve', () => {
    it('should resolve an intervention flag', async () => {
      const mockResolvedFlag = {
        id: 1,
        swarm_id: 'test-swarm',
        issue_number: 123,
        priority: 'critical',
        reason: 'Agent failure',
        trigger_type: 'agent_failure',
        flagged_at: new Date(),
        resolved_at: new Date(),
        resolved_by: 'admin@test.com',
        resolution_note: 'Fixed manually',
      };

      jest.spyOn(InterventionFlagModel, 'resolve').mockResolvedValue(mockResolvedFlag as any);

      const response = await request(app)
        .put('/api/v1/swarms/test-swarm/interventions/1/resolve')
        .send({
          resolved_by: 'admin@test.com',
          resolution_note: 'Fixed manually',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resolved_by).toBe('admin@test.com');
    });

    it('should return 404 if flag not found', async () => {
      jest.spyOn(InterventionFlagModel, 'resolve').mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/swarms/test-swarm/interventions/999/resolve')
        .send({ resolved_by: 'admin@test.com' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if resolved_by is missing', async () => {
      const response = await request(app)
        .put('/api/v1/swarms/test-swarm/interventions/1/resolve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/swarms/:swarm_id/issues/:issue_id/flag/:flag_id', () => {
    it('should delete an intervention flag', async () => {
      jest.spyOn(InterventionFlagModel, 'delete').mockResolvedValue(true);

      const response = await request(app).delete('/api/v1/swarms/test-swarm/issues/123/flag/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if flag not found', async () => {
      jest.spyOn(InterventionFlagModel, 'delete').mockResolvedValue(false);

      const response = await request(app).delete('/api/v1/swarms/test-swarm/issues/123/flag/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/interventions/bulk-resolve', () => {
    it('should resolve multiple flags at once', async () => {
      jest.spyOn(InterventionFlagModel, 'bulkResolve').mockResolvedValue(3);

      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/interventions/bulk-resolve')
        .send({
          flag_ids: [1, 2, 3],
          resolved_by: 'admin@test.com',
          resolution_note: 'Bulk resolution',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resolved_count).toBe(3);
    });

    it('should return 400 if flag_ids is missing', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/interventions/bulk-resolve')
        .send({ resolved_by: 'admin@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if flag_ids is empty array', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/interventions/bulk-resolve')
        .send({
          flag_ids: [],
          resolved_by: 'admin@test.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if resolved_by is missing', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/test-swarm/interventions/bulk-resolve')
        .send({ flag_ids: [1, 2, 3] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
