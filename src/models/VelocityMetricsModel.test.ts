import { VelocityMetricsModel } from './VelocityMetricsModel';

// Mock the database module
jest.mock('../database/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import dbPool from '../database/db';
const mockQuery = (dbPool as any).query;

describe('VelocityMetricsModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findBySwarmAndDateRange()', () => {
    it('should return velocity metrics within date range', async () => {
      const mockMetrics = [
        {
          id: 1,
          swarm_id: 'swarm-1',
          date: '2025-10-02',
          issues_closed: 7,
          issues_opened: 2,
          net_progress: 5,
          avg_completion_time_hours: 12.5,
          created_at: new Date('2025-10-02T12:00:00Z'),
        },
        {
          id: 2,
          swarm_id: 'swarm-1',
          date: '2025-10-01',
          issues_closed: 5,
          issues_opened: 3,
          net_progress: 2,
          avg_completion_time_hours: 15.2,
          created_at: new Date('2025-10-01T12:00:00Z'),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockMetrics });

      const result = await VelocityMetricsModel.findBySwarmAndDateRange(
        'swarm-1',
        '2025-10-01',
        '2025-10-02'
      );

      expect(result).toEqual(mockMetrics);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM velocity_metrics'),
        ['swarm-1', '2025-10-01', '2025-10-02']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE swarm_id = $1'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND date >= $2'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND date <= $3'),
        expect.any(Array)
      );
    });

    it('should return empty array when no metrics found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await VelocityMetricsModel.findBySwarmAndDateRange(
        'non-existent',
        '2025-10-01',
        '2025-10-02'
      );

      expect(result).toEqual([]);
    });

    it('should order results by date descending', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.findBySwarmAndDateRange(
        'swarm-1',
        '2025-09-01',
        '2025-10-01'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY date DESC'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(
        VelocityMetricsModel.findBySwarmAndDateRange('swarm-1', '2025-10-01', '2025-10-02')
      ).rejects.toThrow('Connection failed');
    });

    it('should handle special characters in swarm_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.findBySwarmAndDateRange(
        'swarm-with-special_chars-123',
        '2025-10-01',
        '2025-10-02'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-with-special_chars-123', '2025-10-01', '2025-10-02']
      );
    });

    it('should handle same start and end date', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.findBySwarmAndDateRange(
        'swarm-1',
        '2025-10-01',
        '2025-10-01'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', '2025-10-01', '2025-10-01']
      );
    });
  });

  describe('upsert()', () => {
    it('should insert new velocity metric', async () => {
      const mockMetric = {
        id: 1,
        swarm_id: 'swarm-1',
        date: '2025-10-02',
        issues_closed: 7,
        issues_opened: 2,
        net_progress: 5,
        avg_completion_time_hours: 12.5,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockMetric] });

      const result = await VelocityMetricsModel.upsert(
        'swarm-1',
        '2025-10-02',
        7,
        2,
        12.5
      );

      expect(result).toEqual(mockMetric);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO velocity_metrics'),
        ['swarm-1', '2025-10-02', 7, 2, 5, 12.5]
      );
    });

    it('should update existing velocity metric on conflict', async () => {
      const mockMetric = {
        id: 1,
        swarm_id: 'swarm-1',
        date: '2025-10-02',
        issues_closed: 10,
        issues_opened: 3,
        net_progress: 7,
        avg_completion_time_hours: 10.0,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockMetric] });

      const result = await VelocityMetricsModel.upsert(
        'swarm-1',
        '2025-10-02',
        10,
        3,
        10.0
      );

      expect(result).toEqual(mockMetric);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (swarm_id, date)'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DO UPDATE SET'),
        expect.any(Array)
      );
    });

    it('should calculate net_progress correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 15, 5, 8.0);

      // net_progress = 15 - 5 = 10
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', '2025-10-02', 15, 5, 10, 8.0]
      );
    });

    it('should handle negative net_progress', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 3, 8, 12.0);

      // net_progress = 3 - 8 = -5
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', '2025-10-02', 3, 8, -5, 12.0]
      );
    });

    it('should handle zero issues', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 0, 0, null);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', '2025-10-02', 0, 0, 0, null]
      );
    });

    it('should handle null avg_completion_time_hours', async () => {
      const mockMetric = {
        id: 1,
        swarm_id: 'swarm-1',
        date: '2025-10-02',
        issues_closed: 5,
        issues_opened: 2,
        net_progress: 3,
        avg_completion_time_hours: null,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockMetric] });

      const result = await VelocityMetricsModel.upsert(
        'swarm-1',
        '2025-10-02',
        5,
        2,
        null
      );

      expect(result.avg_completion_time_hours).toBeNull();
    });

    it('should return all fields in RETURNING clause', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 5, 2, 10.5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringMatching(/id.*swarm_id.*date.*issues_closed.*issues_opened.*net_progress.*avg_completion_time_hours.*created_at/s),
        expect.any(Array)
      );
    });
  });

  describe('recordCompletion()', () => {
    it('should record issue completion successfully', async () => {
      const mockCompletion = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        closed_at: new Date('2025-10-02T14:30:00Z'),
        time_to_complete_hours: 24.5,
        assigned_agent: 'agent-007',
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockCompletion] });

      const result = await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        42,
        new Date('2025-10-02T14:30:00Z'),
        24.5,
        'agent-007'
      );

      expect(result).toEqual(mockCompletion);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO issue_completions'),
        ['swarm-1', 42, new Date('2025-10-02T14:30:00Z'), 24.5, 'agent-007']
      );
    });

    it('should handle null time_to_complete_hours', async () => {
      const mockCompletion = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        closed_at: new Date('2025-10-02T14:30:00Z'),
        time_to_complete_hours: null,
        assigned_agent: 'agent-007',
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockCompletion] });

      const result = await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        42,
        new Date('2025-10-02T14:30:00Z'),
        null,
        'agent-007'
      );

      expect(result.time_to_complete_hours).toBeNull();
    });

    it('should handle null assigned_agent', async () => {
      const mockCompletion = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        closed_at: new Date('2025-10-02T14:30:00Z'),
        time_to_complete_hours: 12.0,
        assigned_agent: null,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockCompletion] });

      const result = await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        42,
        new Date('2025-10-02T14:30:00Z'),
        12.0,
        null
      );

      expect(result.assigned_agent).toBeNull();
    });

    it('should handle issue number 0', async () => {
      mockQuery.mockResolvedValue({ rows: [{ issue_number: 0 }] });

      await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        0,
        new Date(),
        10.0,
        'agent-001'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([0])
      );
    });

    it('should handle very large issue numbers', async () => {
      mockQuery.mockResolvedValue({ rows: [{ issue_number: 999999 }] });

      await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        999999,
        new Date(),
        5.0,
        'agent-001'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([999999])
      );
    });
  });

  describe('getCompletionsByDateRange()', () => {
    it('should return completions within date range', async () => {
      const startDate = new Date('2025-10-01T00:00:00Z');
      const endDate = new Date('2025-10-02T23:59:59Z');

      const mockCompletions = [
        {
          id: 1,
          swarm_id: 'swarm-1',
          issue_number: 42,
          closed_at: new Date('2025-10-02T14:30:00Z'),
          time_to_complete_hours: 24.5,
          assigned_agent: 'agent-007',
          created_at: new Date(),
        },
        {
          id: 2,
          swarm_id: 'swarm-1',
          issue_number: 43,
          closed_at: new Date('2025-10-01T10:00:00Z'),
          time_to_complete_hours: 12.0,
          assigned_agent: 'agent-008',
          created_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockCompletions });

      const result = await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        startDate,
        endDate
      );

      expect(result).toEqual(mockCompletions);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM issue_completions'),
        ['swarm-1', startDate, endDate]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE swarm_id = $1'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND closed_at >= $2'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND closed_at < $3'),
        expect.any(Array)
      );
    });

    it('should return empty array when no completions found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        new Date('2025-10-01'),
        new Date('2025-10-02')
      );

      expect(result).toEqual([]);
    });

    it('should order results by closed_at descending', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        new Date('2025-10-01'),
        new Date('2025-10-02')
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY closed_at DESC'),
        expect.any(Array)
      );
    });

    it('should handle same start and end date', async () => {
      const sameDate = new Date('2025-10-01T12:00:00Z');
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        sameDate,
        sameDate
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', sameDate, sameDate]
      );
    });

    it('should use Date objects as parameters', async () => {
      const startDate = new Date('2025-10-01T00:00:00Z');
      const endDate = new Date('2025-10-02T23:59:59Z');

      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        startDate,
        endDate
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', startDate, endDate]
      );
    });
  });

  describe('getAllSwarmIds()', () => {
    it('should return all unique swarm IDs', async () => {
      const mockRows = [
        { swarm_id: 'swarm-1' },
        { swarm_id: 'swarm-2' },
        { swarm_id: 'swarm-3' },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await VelocityMetricsModel.getAllSwarmIds();

      expect(result).toEqual(['swarm-1', 'swarm-2', 'swarm-3']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT swarm_id')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM velocity_metrics')
      );
    });

    it('should return empty array when no swarms exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await VelocityMetricsModel.getAllSwarmIds();

      expect(result).toEqual([]);
    });

    it('should order results by swarm_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.getAllSwarmIds();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY swarm_id')
      );
    });

    it('should handle single swarm', async () => {
      const mockRows = [{ swarm_id: 'swarm-solo' }];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await VelocityMetricsModel.getAllSwarmIds();

      expect(result).toEqual(['swarm-solo']);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(VelocityMetricsModel.getAllSwarmIds()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('SQL Injection Protection', () => {
    it('should use parameterized queries for findBySwarmAndDateRange', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.findBySwarmAndDateRange(
        "'; DROP TABLE velocity_metrics; --",
        '2025-10-01',
        '2025-10-02'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ["'; DROP TABLE velocity_metrics; --", '2025-10-01', '2025-10-02']
      );
    });

    it('should use parameterized queries for upsert', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert(
        "1' OR '1'='1",
        '2025-10-01',
        5,
        2,
        10.0
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["1' OR '1'='1"])
      );
    });

    it('should use parameterized queries for recordCompletion', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.recordCompletion(
        "'; DELETE FROM issue_completions; --",
        42,
        new Date(),
        10.0,
        'agent-001'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["'; DELETE FROM issue_completions; --"])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers for issues_closed', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 999999, 0, 5.0);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([999999])
      );
    });

    it('should handle very small decimal values for avg_completion_time_hours', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.upsert('swarm-1', '2025-10-02', 5, 2, 0.01);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([0.01])
      );
    });

    it('should handle very large decimal values for time_to_complete_hours', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        42,
        new Date(),
        9999.99,
        'agent-001'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([9999.99])
      );
    });

    it('should handle long agent names', async () => {
      const longAgentName = 'agent-' + 'x'.repeat(500);
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VelocityMetricsModel.recordCompletion(
        'swarm-1',
        42,
        new Date(),
        10.0,
        longAgentName
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([longAgentName])
      );
    });

    it('should handle dates far in the future', async () => {
      const futureDate = new Date('2099-12-31T23:59:59Z');
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.getCompletionsByDateRange(
        'swarm-1',
        new Date('2099-01-01'),
        futureDate
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([futureDate])
      );
    });

    it('should handle dates far in the past', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await VelocityMetricsModel.findBySwarmAndDateRange(
        'swarm-1',
        '1970-01-01',
        '1970-12-31'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', '1970-01-01', '1970-12-31']
      );
    });
  });
});
