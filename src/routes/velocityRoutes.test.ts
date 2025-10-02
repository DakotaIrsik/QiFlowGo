import request from 'supertest';
import express, { Application } from 'express';
import velocityRoutes from './velocityRoutes';
import { VelocityService } from '../services/velocityService';
import { VelocityMetricsModel } from '../models/VelocityMetricsModel';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';

// Mock dependencies
jest.mock('../services/velocityService');
jest.mock('../models/VelocityMetricsModel');
jest.mock('../models/SwarmModel');
jest.mock('../services/cacheService');

describe('Velocity Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', velocityRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (cache.get as jest.Mock).mockReturnValue(null);
    (cache.set as jest.Mock).mockReturnValue(undefined);
    (cache.invalidatePattern as jest.Mock).mockReturnValue(undefined);
  });

  describe('GET /api/v1/swarms/:swarm_id/velocity', () => {
    it('should return velocity metrics for a swarm', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      const mockVelocity = {
        issues_per_day: 6.2,
        last_n_days: [5, 8, 7, 6, 4, 9, 7],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };
      const mockTrend = {
        trend: 'stable',
        trend_percentage: 2.3,
        slope: 0.1,
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityService.calculateVelocity as jest.Mock).mockResolvedValue(mockVelocity);
      (VelocityService.detectTrend as jest.Mock).mockReturnValue(mockTrend);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        ...mockVelocity,
        ...mockTrend,
      });
      expect(cache.set).toHaveBeenCalled();
    });

    it('should use custom days parameter', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityService.calculateVelocity as jest.Mock).mockResolvedValue({
        issues_per_day: 5.0,
        last_n_days: [],
        period_days: 14,
        period_start: '2025-09-18',
        period_end: '2025-10-02',
      });
      (VelocityService.detectTrend as jest.Mock).mockReturnValue({
        trend: 'stable',
        trend_percentage: 0,
        slope: 0,
      });

      await request(app)
        .get('/api/v1/swarms/swarm-123/velocity?days=14')
        .expect(200);

      expect(VelocityService.calculateVelocity).toHaveBeenCalledWith('swarm-123', 14);
    });

    it('should cap days at 90', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityService.calculateVelocity as jest.Mock).mockResolvedValue({
        issues_per_day: 5.0,
        last_n_days: [],
        period_days: 90,
        period_start: '2025-07-04',
        period_end: '2025-10-02',
      });
      (VelocityService.detectTrend as jest.Mock).mockReturnValue({
        trend: 'stable',
        trend_percentage: 0,
        slope: 0,
      });

      await request(app)
        .get('/api/v1/swarms/swarm-123/velocity?days=200')
        .expect(200);

      expect(VelocityService.calculateVelocity).toHaveBeenCalledWith('swarm-123', 90);
    });

    it('should return 404 for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/non-existent/velocity')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });

    it('should return cached data when available', async () => {
      const cachedData = { issues_per_day: 6.0, trend: 'stable' };
      (cache.get as jest.Mock).mockReturnValue(cachedData);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(cachedData);
      expect(response.body.cached).toBe(true);
      expect(SwarmModel.findById).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (SwarmModel.findById as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to calculate velocity');
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/forecast', () => {
    it('should return forecast data', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-123',
        name: 'Test Swarm',
        total_issues: 100,
        completed_issues: 42,
      };
      const mockForecast = {
        estimated_completion_date: '2025-11-15',
        days_remaining: 44,
        confidence_level: 0.95,
        confidence_label: 'High',
        based_on_velocity: 6.2,
        remaining_issues: 58,
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityService.generateForecast as jest.Mock).mockResolvedValue(mockForecast);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/forecast')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject(mockForecast);
      expect(response.body.data.last_updated).toBeDefined();
    });

    it('should use default values for missing issue counts', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-123',
        name: 'Test Swarm',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityService.generateForecast as jest.Mock).mockResolvedValue({
        estimated_completion_date: '2025-11-15',
        days_remaining: 44,
        confidence_level: 0.95,
        confidence_label: 'High',
        based_on_velocity: 6.2,
        remaining_issues: 100,
      });

      await request(app)
        .get('/api/v1/swarms/swarm-123/forecast')
        .expect(200);

      expect(VelocityService.generateForecast).toHaveBeenCalledWith('swarm-123', 100, 0);
    });

    it('should return 404 for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/non-existent/forecast')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('GET /api/v1/swarms/:swarm_id/velocity/history', () => {
    it('should return historical metrics', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      const mockMetrics = [
        {
          date: '2025-10-01',
          issues_closed: 7,
          issues_opened: 5,
          net_progress: 2,
          avg_completion_time_hours: 36.2,
        },
        {
          date: '2025-09-30',
          issues_closed: 6,
          issues_opened: 4,
          net_progress: 2,
          avg_completion_time_hours: 42.1,
        },
      ];

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityMetricsModel.findBySwarmAndDateRange as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity/history?start_date=2025-09-30&end_date=2025-10-01')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toHaveLength(2);
      expect(response.body.data.metrics[0]).toMatchObject(mockMetrics[0]);
    });

    it('should return 400 for missing dates', async () => {
      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity/history')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required parameters');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/v1/swarms/swarm-123/velocity/history?start_date=2025/09/30&end_date=2025-10-01')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should return 404 for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/swarms/non-existent/velocity/history?start_date=2025-09-30&end_date=2025-10-01')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('POST /api/v1/swarms/:swarm_id/completions', () => {
    it('should record a completion', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      const mockCompletion = {
        id: 1,
        swarm_id: 'swarm-123',
        issue_number: 42,
        closed_at: new Date('2025-10-02T10:30:00Z'),
        time_to_complete_hours: 48.5,
        assigned_agent: 'Agent-1',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityMetricsModel.recordCompletion as jest.Mock).mockResolvedValue(mockCompletion);

      const response = await request(app)
        .post('/api/v1/swarms/swarm-123/completions')
        .send({
          issue_number: 42,
          closed_at: '2025-10-02T10:30:00Z',
          time_to_complete_hours: 48.5,
          assigned_agent: 'Agent-1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.issue_number).toBe(42);
      expect(cache.invalidatePattern).toHaveBeenCalledWith('velocity:swarm-123');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('forecast:swarm-123');
    });

    it('should use current time if closed_at not provided', async () => {
      const mockSwarm = { swarm_id: 'swarm-123', name: 'Test Swarm' };
      const mockCompletion = {
        id: 1,
        swarm_id: 'swarm-123',
        issue_number: 42,
        closed_at: new Date(),
        time_to_complete_hours: null,
        assigned_agent: null,
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);
      (VelocityMetricsModel.recordCompletion as jest.Mock).mockResolvedValue(mockCompletion);

      const response = await request(app)
        .post('/api/v1/swarms/swarm-123/completions')
        .send({ issue_number: 42 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(VelocityMetricsModel.recordCompletion).toHaveBeenCalledWith(
        'swarm-123',
        42,
        expect.any(Date),
        null,
        null
      );
    });

    it('should return 400 for missing issue_number', async () => {
      const response = await request(app)
        .post('/api/v1/swarms/swarm-123/completions')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field');
    });

    it('should return 404 for non-existent swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/swarms/non-existent/completions')
        .send({ issue_number: 42 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Swarm not found');
    });
  });

  describe('POST /api/v1/velocity/aggregate', () => {
    it('should aggregate metrics for a specific date', async () => {
      (VelocityService.aggregateDailyMetrics as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/velocity/aggregate')
        .send({ date: '2025-10-01' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('2025-10-01');
      expect(VelocityService.aggregateDailyMetrics).toHaveBeenCalledWith('2025-10-01');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('velocity:');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('forecast:');
    });

    it('should default to yesterday if no date provided', async () => {
      (VelocityService.aggregateDailyMetrics as jest.Mock).mockResolvedValue(undefined);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().split('T')[0];

      await request(app)
        .post('/api/v1/velocity/aggregate')
        .send({})
        .expect(200);

      expect(VelocityService.aggregateDailyMetrics).toHaveBeenCalledWith(expectedDate);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post('/api/v1/velocity/aggregate')
        .send({ date: '2025/10/01' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should handle errors gracefully', async () => {
      (VelocityService.aggregateDailyMetrics as jest.Mock).mockRejectedValue(
        new Error('Aggregation failed')
      );

      const response = await request(app)
        .post('/api/v1/velocity/aggregate')
        .send({ date: '2025-10-01' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to aggregate metrics');
    });
  });
});
