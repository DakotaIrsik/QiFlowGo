import { Pool } from 'pg';
import { InterventionFlagModel } from './InterventionFlagModel';
import { NotificationService } from '../services/notificationService';

// Mock dependencies
jest.mock('../database/db');
jest.mock('../services/notificationService');

import { query } from '../database/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('InterventionFlagModel Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new flag and send notification', async () => {
      const mockFlag = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        github_url: 'https://github.com/test/repo/issues/42',
        priority: 'critical',
        reason: 'Blocked for 24 hours',
        trigger_type: 'automatic',
        agent_message: null,
        blocked_duration_hours: 24,
        failure_count: null,
        flagged_at: new Date(),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        metadata: null,
      };

      mockQuery.mockResolvedValue({
        rows: [mockFlag],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.create({
        swarm_id: 'swarm-1',
        issue_number: 42,
        github_url: 'https://github.com/test/repo/issues/42',
        priority: 'critical',
        reason: 'Blocked for 24 hours',
        trigger_type: 'blocked_duration',
        blocked_duration_hours: 24,
      });

      expect(result).toMatchObject({
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        priority: 'critical',
      });

      expect(NotificationService.sendInterventionNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      );
    });

    it('should handle upsert on conflict', async () => {
      const existingFlag = {
        id: 5,
        swarm_id: 'swarm-1',
        issue_number: 42,
        github_url: 'https://github.com/test/repo/issues/42',
        priority: 'review',
        reason: 'Updated reason',
        trigger_type: 'automatic',
        agent_message: null,
        blocked_duration_hours: 48,
        failure_count: null,
        flagged_at: new Date(),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        metadata: null,
      };

      mockQuery.mockResolvedValue({
        rows: [existingFlag],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.create({
        swarm_id: 'swarm-1',
        issue_number: 42,
        github_url: 'https://github.com/test/repo/issues/42',
        priority: 'review',
        reason: 'Updated reason',
        trigger_type: 'agent_failure',
        blocked_duration_hours: 48,
      });

      expect(result.blocked_duration_hours).toBe(48);
    });

    it('should handle metadata as JSON', async () => {
      const mockFlag = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        github_url: 'https://github.com/test/repo/issues/42',
        priority: 'critical',
        reason: 'Test',
        trigger_type: 'manual',
        agent_message: null,
        blocked_duration_hours: null,
        failure_count: null,
        flagged_at: new Date(),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        metadata: { note: 'Custom note', user: 'admin' },
      };

      mockQuery.mockResolvedValue({
        rows: [mockFlag],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.create({
        swarm_id: 'swarm-1',
        issue_number: 42,
        priority: 'critical',
        reason: 'Test',
        trigger_type: 'manual',
        metadata: { note: 'Custom note', user: 'admin' },
      });

      expect(result.metadata).toEqual({ note: 'Custom note', user: 'admin' });

      // Verify metadata was stringified in the query
      const queryCall = mockQuery.mock.calls[0];
      const params = queryCall[1];
      expect(params).toBeDefined();
      expect(typeof params![9]).toBe('string'); // metadata parameter
    });
  });

  describe('find', () => {
    it('should find flags with all filters', async () => {
      const mockFlags = [
        {
          id: 1,
          swarm_id: 'swarm-1',
          issue_number: 42,
          priority: 'critical',
          resolved_at: null,
        },
        {
          id: 2,
          swarm_id: 'swarm-1',
          issue_number: 43,
          priority: 'critical',
          resolved_at: null,
        },
      ];

      mockQuery.mockResolvedValue({
        rows: mockFlags,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.find({
        swarm_id: 'swarm-1',
        priority: 'critical',
        resolved: false,
        limit: 10,
        offset: 5,
      });

      expect(result).toHaveLength(2);

      // Verify SQL query construction
      const sqlQuery = mockQuery.mock.calls[0][0];
      expect(sqlQuery).toContain('WHERE swarm_id = $1');
      expect(sqlQuery).toContain('AND priority = $2');
      expect(sqlQuery).toContain('AND resolved_at IS NULL');
      expect(sqlQuery).toContain('LIMIT');
      expect(sqlQuery).toContain('OFFSET');
    });

    it('should find only resolved flags', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.find({
        swarm_id: 'swarm-1',
        resolved: true,
      });

      const sqlQuery = mockQuery.mock.calls[0][0];
      expect(sqlQuery).toContain('AND resolved_at IS NOT NULL');
    });

    it('should order by flagged_at DESC', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.find({
        swarm_id: 'swarm-1',
      });

      const sqlQuery = mockQuery.mock.calls[0][0];
      expect(sqlQuery).toContain('ORDER BY flagged_at DESC');
    });
  });

  describe('getCount', () => {
    it('should return counts by priority', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            critical: '5',
            review: '3',
            total: '8',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.getCount('swarm-1');

      expect(result).toEqual({
        critical: 5,
        review: 3,
        total: 8,
      });
    });

    it('should handle zero counts', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            critical: '0',
            review: '0',
            total: '0',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.getCount('swarm-empty');

      expect(result).toEqual({
        critical: 0,
        review: 0,
        total: 0,
      });
    });
  });

  describe('resolve', () => {
    it('should resolve an unresolved flag', async () => {
      const resolvedFlag = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        resolved_at: new Date(),
        resolved_by: 'user123',
        resolution_note: 'Fixed the issue',
      };

      mockQuery.mockResolvedValue({
        rows: [resolvedFlag],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.resolve({
        flag_id: 1,
        resolved_by: 'user123',
        resolution_note: 'Fixed the issue',
      });

      expect(result).not.toBeNull();
      expect(result?.resolved_by).toBe('user123');
      expect(result?.resolution_note).toBe('Fixed the issue');
    });

    it('should return null if flag not found or already resolved', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.resolve({
        flag_id: 999,
        resolved_by: 'user123',
      });

      expect(result).toBeNull();
    });

    it('should only resolve unresolved flags', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.resolve({
        flag_id: 1,
        resolved_by: 'user123',
      });

      const sqlQuery = mockQuery.mock.calls[0][0];
      expect(sqlQuery).toContain('WHERE id = $3 AND resolved_at IS NULL');
    });
  });

  describe('bulkResolve', () => {
    it('should resolve multiple flags', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 3,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const count = await InterventionFlagModel.bulkResolve(
        [1, 2, 3],
        'admin',
        'Bulk resolution'
      );

      expect(count).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['admin', 'Bulk resolution', [1, 2, 3]]
      );
    });

    it('should return 0 if no flags resolved', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const count = await InterventionFlagModel.bulkResolve([999], 'admin');

      expect(count).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a flag', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.delete(1);

      expect(result).toBe(true);
    });

    it('should return false if flag not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await InterventionFlagModel.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('trackAgentFailure', () => {
    it('should track failure and return count', async () => {
      // Mock INSERT
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      // Mock SELECT count
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '3' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const count = await InterventionFlagModel.trackAgentFailure(
        'swarm-1',
        42,
        'test-agent',
        'Connection timeout',
        { retry_count: 3 }
      );

      expect(count).toBe(3);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle metadata as JSON', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.trackAgentFailure(
        'swarm-1',
        42,
        'agent',
        'error',
        { key: 'value' }
      );

      const insertCall = mockQuery.mock.calls[0];
      const params = insertCall[1];
      expect(params).toBeDefined();
      expect(typeof params![4]).toBe('string'); // metadata should be stringified
    });
  });

  describe('trackStatusChange', () => {
    it('should track status change', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.trackStatusChange(
        'swarm-1',
        42,
        'blocked',
        { reason: 'Waiting for review' }
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO issue_status_history'),
        expect.arrayContaining(['swarm-1', 42, 'blocked', expect.any(String)])
      );
    });

    it('should handle null metadata', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.trackStatusChange('swarm-1', 42, 'in_progress');

      const params = mockQuery.mock.calls[0][1];
      expect(params).toBeDefined();
      expect(params![3]).toBeNull();
    });
  });

  describe('getBlockedDuration', () => {
    it('should calculate blocked duration in hours', async () => {
      const blockedAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago

      mockQuery.mockResolvedValue({
        rows: [{ changed_at: blockedAt }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const duration = await InterventionFlagModel.getBlockedDuration('swarm-1', 42);

      expect(duration).toBeGreaterThanOrEqual(4); // At least 4 hours
      expect(duration).toBeLessThanOrEqual(6); // At most 6 hours (accounting for test execution time)
    });

    it('should return null if no blocked status found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const duration = await InterventionFlagModel.getBlockedDuration('swarm-1', 42);

      expect(duration).toBeNull();
    });

    it('should get most recent blocked status', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await InterventionFlagModel.getBlockedDuration('swarm-1', 42);

      const sqlQuery = mockQuery.mock.calls[0][0];
      expect(sqlQuery).toContain('ORDER BY changed_at DESC');
      expect(sqlQuery).toContain('LIMIT 1');
    });
  });

  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        InterventionFlagModel.create({
          swarm_id: 'swarm-1',
          issue_number: 42,
          priority: 'critical',
          reason: 'Test',
          trigger_type: 'manual',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors on find', async () => {
      mockQuery.mockRejectedValue(new Error('Query timeout'));

      await expect(
        InterventionFlagModel.find({ swarm_id: 'swarm-1' })
      ).rejects.toThrow('Query timeout');
    });

    it('should handle notification service errors gracefully', async () => {
      const mockFlag = {
        id: 1,
        swarm_id: 'swarm-1',
        issue_number: 42,
        priority: 'critical',
        reason: 'Test',
        trigger_type: 'manual',
        flagged_at: new Date(),
      };

      mockQuery.mockResolvedValue({
        rows: [mockFlag],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      (NotificationService.sendInterventionNotification as jest.Mock).mockRejectedValue(
        new Error('Notification failed')
      );

      // Should still throw since notification is awaited
      await expect(
        InterventionFlagModel.create({
          swarm_id: 'swarm-1',
          issue_number: 42,
          priority: 'critical',
          reason: 'Test',
          trigger_type: 'manual',
        })
      ).rejects.toThrow('Notification failed');
    });
  });
});
