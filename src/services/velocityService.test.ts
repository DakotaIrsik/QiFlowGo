import { VelocityService } from './velocityService';
import { VelocityMetricsModel } from '../models/VelocityMetricsModel';

// Mock the VelocityMetricsModel
jest.mock('../models/VelocityMetricsModel');

describe('VelocityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectTrend', () => {
    it('should detect increasing trend', () => {
      const dailyMetrics = [2, 4, 5, 7, 8, 10, 12];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('increasing');
      expect(result.slope).toBeGreaterThan(0);
      expect(result.trend_percentage).toBeGreaterThan(10);
    });

    it('should detect decreasing trend', () => {
      const dailyMetrics = [12, 10, 8, 7, 5, 4, 2];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('decreasing');
      expect(result.slope).toBeLessThan(0);
      expect(result.trend_percentage).toBeLessThan(-10);
    });

    it('should detect stable trend', () => {
      const dailyMetrics = [5, 6, 5, 6, 5, 6, 5];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('stable');
      expect(Math.abs(result.trend_percentage)).toBeLessThan(10);
    });

    it('should handle edge case with insufficient data', () => {
      const dailyMetrics = [5];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('stable');
      expect(result.slope).toBe(0);
      expect(result.trend_percentage).toBe(0);
    });

    it('should handle empty array', () => {
      const dailyMetrics: number[] = [];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('stable');
      expect(result.slope).toBe(0);
      expect(result.trend_percentage).toBe(0);
    });

    it('should handle all zeros', () => {
      const dailyMetrics = [0, 0, 0, 0, 0];
      const result = VelocityService.detectTrend(dailyMetrics);

      expect(result.trend).toBe('stable');
      expect(result.slope).toBe(0);
      expect(result.trend_percentage).toBe(0);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const result = VelocityService.calculateStdDev(values);

      // Expected standard deviation is 2.0
      expect(result).toBeCloseTo(2.0, 1);
    });

    it('should return 0 for empty array', () => {
      const values: number[] = [];
      const result = VelocityService.calculateStdDev(values);

      expect(result).toBe(0);
    });

    it('should return 0 for single value', () => {
      const values = [5];
      const result = VelocityService.calculateStdDev(values);

      expect(result).toBe(0);
    });

    it('should return 0 for all same values', () => {
      const values = [5, 5, 5, 5, 5];
      const result = VelocityService.calculateStdDev(values);

      expect(result).toBe(0);
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for low variance', () => {
      const velocityData = {
        issues_per_day: 6.0,
        last_n_days: [6, 6, 6, 6, 6, 6, 6],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };

      const result = VelocityService.calculateConfidence(velocityData);
      expect(result).toBe(0.95);
    });

    it('should return medium confidence for moderate variance', () => {
      const velocityData = {
        issues_per_day: 6.0,
        last_n_days: [4, 5, 6, 7, 8, 5, 6],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };

      const result = VelocityService.calculateConfidence(velocityData);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should return low confidence for high variance', () => {
      const velocityData = {
        issues_per_day: 6.0,
        last_n_days: [1, 10, 2, 12, 3, 11, 4],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };

      const result = VelocityService.calculateConfidence(velocityData);
      expect(result).toBe(0.50);
    });

    it('should handle zero mean', () => {
      const velocityData = {
        issues_per_day: 0,
        last_n_days: [0, 0, 0, 0, 0, 0, 0],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };

      const result = VelocityService.calculateConfidence(velocityData);
      expect(result).toBe(0.5);
    });

    it('should handle empty data', () => {
      const velocityData = {
        issues_per_day: 0,
        last_n_days: [],
        period_days: 7,
        period_start: '2025-09-25',
        period_end: '2025-10-02',
      };

      const result = VelocityService.calculateConfidence(velocityData);
      expect(result).toBe(0.5);
    });
  });

  describe('adjustForTrend', () => {
    it('should reduce days for increasing trend', () => {
      const daysToCompletion = 100;
      const trend = {
        trend: 'increasing' as const,
        trend_percentage: 20,
        slope: 0.5,
      };

      const result = VelocityService.adjustForTrend(daysToCompletion, trend);
      expect(result).toBeLessThan(daysToCompletion);
      expect(result).toBe(80); // 100 * (1 - 0.20)
    });

    it('should increase days for decreasing trend', () => {
      const daysToCompletion = 100;
      const trend = {
        trend: 'decreasing' as const,
        trend_percentage: -20,
        slope: -0.5,
      };

      const result = VelocityService.adjustForTrend(daysToCompletion, trend);
      expect(result).toBeGreaterThan(daysToCompletion);
      expect(result).toBe(120); // 100 * (1 + 0.20)
    });

    it('should not adjust for stable trend', () => {
      const daysToCompletion = 100;
      const trend = {
        trend: 'stable' as const,
        trend_percentage: 5,
        slope: 0.1,
      };

      const result = VelocityService.adjustForTrend(daysToCompletion, trend);
      expect(result).toBe(daysToCompletion);
    });
  });

  describe('calculateVelocity', () => {
    it('should calculate velocity correctly', async () => {
      const mockMetrics = [
        { date: '2025-09-26', issues_closed: 5 },
        { date: '2025-09-27', issues_closed: 8 },
        { date: '2025-09-28', issues_closed: 7 },
        { date: '2025-09-29', issues_closed: 6 },
        { date: '2025-09-30', issues_closed: 4 },
        { date: '2025-10-01', issues_closed: 9 },
        { date: '2025-10-02', issues_closed: 7 },
      ];

      (VelocityMetricsModel.findBySwarmAndDateRange as jest.Mock).mockResolvedValue(mockMetrics);

      const result = await VelocityService.calculateVelocity('swarm-123', 7);

      expect(result.issues_per_day).toBeCloseTo(6.57, 1);
      expect(result.last_n_days).toEqual([5, 8, 7, 6, 4, 9, 7]);
      expect(result.period_days).toBe(7);
    });

    it('should handle no data', async () => {
      (VelocityMetricsModel.findBySwarmAndDateRange as jest.Mock).mockResolvedValue([]);

      const result = await VelocityService.calculateVelocity('swarm-123', 7);

      expect(result.issues_per_day).toBe(0);
      expect(result.last_n_days).toEqual([]);
    });
  });

  describe('generateForecast', () => {
    beforeEach(() => {
      const mockMetrics = [
        { date: '2025-09-26', issues_closed: 5 },
        { date: '2025-09-27', issues_closed: 6 },
        { date: '2025-09-28', issues_closed: 6 },
        { date: '2025-09-29', issues_closed: 6 },
        { date: '2025-09-30', issues_closed: 6 },
        { date: '2025-10-01', issues_closed: 6 },
        { date: '2025-10-02', issues_closed: 7 },
      ];

      (VelocityMetricsModel.findBySwarmAndDateRange as jest.Mock).mockResolvedValue(mockMetrics);
    });

    it('should generate forecast correctly', async () => {
      const result = await VelocityService.generateForecast('swarm-123', 100, 58);

      expect(result.remaining_issues).toBe(42);
      expect(result.based_on_velocity).toBeCloseTo(6.0, 1);
      expect(result.days_remaining).toBeGreaterThan(0);
      expect(result.confidence_level).toBeGreaterThan(0);
      expect(['High', 'Medium', 'Low']).toContain(result.confidence_label);
    });

    it('should handle completed project', async () => {
      const result = await VelocityService.generateForecast('swarm-123', 100, 100);

      expect(result.remaining_issues).toBe(0);
      expect(result.days_remaining).toBe(0);
      expect(result.confidence_level).toBe(1.0);
      expect(result.confidence_label).toBe('High');
    });

    it('should handle zero velocity', async () => {
      (VelocityMetricsModel.findBySwarmAndDateRange as jest.Mock).mockResolvedValue([
        { date: '2025-09-26', issues_closed: 0 },
        { date: '2025-09-27', issues_closed: 0 },
      ]);

      const result = await VelocityService.generateForecast('swarm-123', 100, 50);

      expect(result.estimated_completion_date).toBe('N/A');
      expect(result.days_remaining).toBe(-1);
      expect(result.confidence_level).toBe(0.0);
      expect(result.confidence_label).toBe('Low');
    });

    it('should handle over-completion', async () => {
      const result = await VelocityService.generateForecast('swarm-123', 100, 110);

      expect(result.remaining_issues).toBe(0);
      expect(result.days_remaining).toBe(0);
    });
  });

  describe('aggregateDailyMetrics', () => {
    it('should aggregate metrics for all swarms', async () => {
      const mockSwarmIds = ['swarm-1', 'swarm-2'];
      const mockCompletions = [
        { swarm_id: 'swarm-1', issue_number: 1, time_to_complete_hours: 24 },
        { swarm_id: 'swarm-1', issue_number: 2, time_to_complete_hours: 36 },
      ];

      (VelocityMetricsModel.getAllSwarmIds as jest.Mock).mockResolvedValue(mockSwarmIds);
      (VelocityMetricsModel.getCompletionsByDateRange as jest.Mock).mockResolvedValue(mockCompletions);
      (VelocityMetricsModel.upsert as jest.Mock).mockResolvedValue({});

      await VelocityService.aggregateDailyMetrics('2025-10-01');

      expect(VelocityMetricsModel.getAllSwarmIds).toHaveBeenCalled();
      expect(VelocityMetricsModel.getCompletionsByDateRange).toHaveBeenCalledTimes(2);
      expect(VelocityMetricsModel.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
