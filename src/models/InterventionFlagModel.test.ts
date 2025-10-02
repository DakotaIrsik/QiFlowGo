import { InterventionFlagModel } from './InterventionFlagModel';
import * as db from '../database/db';
import {
  CreateInterventionFlagParams,
  ResolveInterventionFlagParams,
  InterventionFlagQuery,
} from '../types/interventionFlag';

// Mock the database module
jest.mock('../database/db');

describe('InterventionFlagModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new intervention flag', async () => {
      const mockRow = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Test reason',
        trigger_type: 'manual',
        agent_message: null,
        blocked_duration_hours: null,
        failure_count: null,
        flagged_at: new Date('2024-01-01'),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        metadata: null,
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const params: CreateInterventionFlagParams = {
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Test reason',
        trigger_type: 'manual',
      };

      const result = await InterventionFlagModel.create(params);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO intervention_flags'),
        expect.arrayContaining([
          'swarm-1',
          123,
          'https://github.com/test/repo/issues/123',
          'critical',
          'Test reason',
          'manual',
        ])
      );
      expect(result).toMatchObject({
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        priority: 'critical',
      });
    });

    it('should handle metadata when creating flag', async () => {
      const mockRow = {
        id: 2,
        swarm_id: 'swarm-2',
        issue_number: 456,
        github_url: null,
        priority: 'review',
        reason: 'Test with metadata',
        trigger_type: 'test_failure',
        agent_message: null,
        blocked_duration_hours: null,
        failure_count: null,
        flagged_at: new Date('2024-01-01'),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        metadata: { test: 'data' },
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const params: CreateInterventionFlagParams = {
        swarm_id: 'swarm-2',
        issue_number: 456,
        priority: 'review',
        reason: 'Test with metadata',
        trigger_type: 'test_failure',
        metadata: { test: 'data' },
      };

      const result = await InterventionFlagModel.create(params);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{"test":"data"}'])
      );
      expect(result.metadata).toEqual({ test: 'data' });
    });
  });

  describe('find', () => {
    it('should find flags by swarm_id', async () => {
      const mockRows = [
        {
          id: 1,
          swarm_id: 'swarm-1',
          issue_number: 123,
          github_url: null,
          priority: 'critical',
          reason: 'Test 1',
          trigger_type: 'manual',
          agent_message: null,
          blocked_duration_hours: null,
          failure_count: null,
          flagged_at: new Date('2024-01-01'),
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
          metadata: null,
        },
      ];

      (db.query as jest.Mock).mockResolvedValue({ rows: mockRows });

      const query: InterventionFlagQuery = {
        swarm_id: 'swarm-1',
      };

      const results = await InterventionFlagModel.find(query);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM intervention_flags'),
        ['swarm-1']
      );
      expect(results).toHaveLength(1);
      expect(results[0].swarm_id).toBe('swarm-1');
    });

    it('should filter by priority', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const query: InterventionFlagQuery = {
        swarm_id: 'swarm-1',
        priority: 'critical',
      };

      await InterventionFlagModel.find(query);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND priority = $2'),
        ['swarm-1', 'critical']
      );
    });

    it('should filter by resolved status - unresolved', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const query: InterventionFlagQuery = {
        swarm_id: 'swarm-1',
        resolved: false,
      };

      await InterventionFlagModel.find(query);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND resolved_at IS NULL'),
        ['swarm-1']
      );
    });

    it('should filter by resolved status - resolved', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const query: InterventionFlagQuery = {
        swarm_id: 'swarm-1',
        resolved: true,
      };

      await InterventionFlagModel.find(query);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND resolved_at IS NOT NULL'),
        ['swarm-1']
      );
    });

    it('should apply limit and offset', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const query: InterventionFlagQuery = {
        swarm_id: 'swarm-1',
        limit: 10,
        offset: 20,
      };

      await InterventionFlagModel.find(query);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['swarm-1', 10, 20]
      );
    });
  });

  describe('getCount', () => {
    it('should return counts by priority', async () => {
      const mockRow = {
        critical: '5',
        review: '3',
        total: '8',
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await InterventionFlagModel.getCount('swarm-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FILTER'),
        ['swarm-1']
      );
      expect(result).toEqual({
        critical: 5,
        review: 3,
        total: 8,
      });
    });

    it('should return zero counts when no flags exist', async () => {
      const mockRow = {
        critical: '0',
        review: '0',
        total: '0',
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await InterventionFlagModel.getCount('swarm-1');

      expect(result).toEqual({
        critical: 0,
        review: 0,
        total: 0,
      });
    });
  });

  describe('resolve', () => {
    it('should resolve a flag successfully', async () => {
      const mockRow = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: null,
        priority: 'critical',
        reason: 'Test',
        trigger_type: 'manual',
        agent_message: null,
        blocked_duration_hours: null,
        failure_count: null,
        flagged_at: new Date('2024-01-01'),
        resolved_at: new Date('2024-01-02'),
        resolved_by: 'user123',
        resolution_note: 'Fixed',
        metadata: null,
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const params: ResolveInterventionFlagParams = {
        flag_id: 1,
        resolved_by: 'user123',
        resolution_note: 'Fixed',
      };

      const result = await InterventionFlagModel.resolve(params);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE intervention_flags'),
        ['user123', 'Fixed', 1]
      );
      expect(result).toBeTruthy();
      expect(result?.resolved_by).toBe('user123');
    });

    it('should return null if flag not found or already resolved', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const params: ResolveInterventionFlagParams = {
        flag_id: 999,
        resolved_by: 'user123',
      };

      const result = await InterventionFlagModel.resolve(params);

      expect(result).toBeNull();
    });
  });

  describe('bulkResolve', () => {
    it('should resolve multiple flags', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 3 });

      const count = await InterventionFlagModel.bulkResolve(
        [1, 2, 3],
        'user123',
        'Bulk fixed'
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ANY($3)'),
        ['user123', 'Bulk fixed', [1, 2, 3]]
      );
      expect(count).toBe(3);
    });

    it('should return 0 if no flags resolved', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 0 });

      const count = await InterventionFlagModel.bulkResolve([999], 'user123');

      expect(count).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a flag successfully', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      const result = await InterventionFlagModel.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM intervention_flags WHERE id = $1',
        [1]
      );
      expect(result).toBe(true);
    });

    it('should return false if flag not found', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 0 });

      const result = await InterventionFlagModel.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('trackAgentFailure', () => {
    it('should record failure and return count', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // COUNT

      const count = await InterventionFlagModel.trackAgentFailure(
        'swarm-1',
        123,
        'Agent-1',
        'Build failed'
      );

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO agent_failures'),
        ['swarm-1', 123, 'Agent-1', 'Build failed', null]
      );
      expect(count).toBe(3);
    });

    it('should handle metadata', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await InterventionFlagModel.trackAgentFailure(
        'swarm-1',
        123,
        'Agent-1',
        'Error',
        { test: 'data' }
      );

      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.arrayContaining(['{"test":"data"}'])
      );
    });
  });

  describe('trackStatusChange', () => {
    it('should record status change', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await InterventionFlagModel.trackStatusChange('swarm-1', 123, 'blocked');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO issue_status_history'),
        ['swarm-1', 123, 'blocked', null]
      );
    });

    it('should record status change with metadata', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await InterventionFlagModel.trackStatusChange('swarm-1', 123, 'in_progress', {
        assignee: 'agent-1',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-1', 123, 'in_progress', '{"assignee":"agent-1"}']
      );
    });
  });

  describe('getBlockedDuration', () => {
    it('should return duration in hours when issue is blocked', async () => {
      const blockedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ changed_at: blockedAt }],
      });

      const duration = await InterventionFlagModel.getBlockedDuration('swarm-1', 123);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM issue_status_history'),
        ['swarm-1', 123]
      );
      expect(duration).toBeGreaterThanOrEqual(47);
      expect(duration).toBeLessThanOrEqual(49);
    });

    it('should return null when no blocked status found', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const duration = await InterventionFlagModel.getBlockedDuration('swarm-1', 123);

      expect(duration).toBeNull();
    });

    it('should calculate correct duration for recent block', async () => {
      const blockedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ changed_at: blockedAt }],
      });

      const duration = await InterventionFlagModel.getBlockedDuration('swarm-1', 123);

      expect(duration).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThanOrEqual(3);
    });
  });
});
