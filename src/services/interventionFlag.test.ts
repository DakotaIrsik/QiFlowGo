import { InterventionFlagModel } from '../models/InterventionFlagModel';
import { FlaggingService } from './flaggingService';
import { NotificationService } from './notificationService';

// Mock dependencies
jest.mock('../models/InterventionFlagModel');
jest.mock('./notificationService');

describe('FlaggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('flagBlockedIssue', () => {
    it('should create intervention flag for blocked issue', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({
        id: 1,
        swarm_id: 'test-swarm',
        issue_number: 123,
        priority: 'review',
        reason: 'Blocked for 48 hours',
        trigger_type: 'blocked_duration',
        blocked_duration_hours: 48,
        flagged_at: new Date(),
      } as any);

      await FlaggingService.flagBlockedIssue('test-swarm', 123, 48, 'https://github.com/test/repo/issues/123');

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'review',
        reason: 'Blocked for 48 hours',
        trigger_type: 'blocked_duration',
        blocked_duration_hours: 48,
      });
    });
  });

  describe('onAgentRunComplete', () => {
    it('should track failure when agent run fails', async () => {
      const mockTrackFailure = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(2);

      await FlaggingService.onAgentRunComplete(
        'test-swarm',
        123,
        'failed',
        'test-agent',
        'Error: test error'
      );

      expect(mockTrackFailure).toHaveBeenCalledWith(
        'test-swarm',
        123,
        'test-agent',
        'Error: test error'
      );
    });

    it('should create critical flag after 3 consecutive failures', async () => {
      const mockTrackFailure = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(3);
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.onAgentRunComplete(
        'test-swarm',
        123,
        'failed',
        'test-agent',
        'Error: repeated failure'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: undefined,
        priority: 'critical',
        reason: 'Agent failed 3 consecutive times',
        trigger_type: 'agent_failure',
        failure_count: 3,
        agent_message: 'Error: repeated failure',
      });
    });

    it('should not flag if less than 3 failures', async () => {
      const mockTrackFailure = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(2);
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create');

      await FlaggingService.onAgentRunComplete('test-swarm', 123, 'failed');

      expect(mockTrackFailure).toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should not track failure when agent run succeeds', async () => {
      const mockTrackFailure = jest.spyOn(InterventionFlagModel, 'trackAgentFailure');

      await FlaggingService.onAgentRunComplete('test-swarm', 123, 'success');

      expect(mockTrackFailure).not.toHaveBeenCalled();
    });
  });

  describe('flagSecurityVulnerability', () => {
    it('should create critical flag for security vulnerability', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagSecurityVulnerability(
        'test-swarm',
        123,
        'CVE-2024-1234: SQL Injection',
        'high',
        'https://github.com/test/repo/issues/123'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Security vulnerability detected (high)',
        trigger_type: 'security_vulnerability',
        agent_message: 'CVE-2024-1234: SQL Injection',
        metadata: {
          severity: 'high',
          details: 'CVE-2024-1234: SQL Injection',
        },
      });
    });
  });

  describe('flagTestFailures', () => {
    it('should create flag when test failure rate exceeds 10%', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagTestFailures(
        'test-swarm',
        123,
        0.15,
        ['test1.ts', 'test2.ts']
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: undefined,
        priority: 'review',
        reason: 'Test failure rate: 15.0%',
        trigger_type: 'test_failure',
        metadata: {
          failure_rate: 0.15,
          failed_tests: ['test1.ts', 'test2.ts'],
        },
      });
    });

    it('should not flag when test failure rate is 10% or less', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create');

      await FlaggingService.flagTestFailures('test-swarm', 123, 0.10, ['test1.ts']);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should not flag when test failure rate is 0%', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create');

      await FlaggingService.flagTestFailures('test-swarm', 123, 0, []);

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('flagMergeConflict', () => {
    it('should create critical flag for merge conflict', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagMergeConflict(
        'test-swarm',
        123,
        ['src/app.ts', 'src/server.ts'],
        'Conflict in multiple files'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: undefined,
        priority: 'critical',
        reason: 'Unable to resolve merge conflict',
        trigger_type: 'merge_conflict',
        agent_message: 'Conflict in multiple files',
        metadata: {
          conflicting_files: ['src/app.ts', 'src/server.ts'],
        },
      });
    });
  });

  describe('trackIssueStatusChange', () => {
    it('should track status change in database', async () => {
      const mockTrackStatus = jest.spyOn(InterventionFlagModel, 'trackStatusChange').mockResolvedValue();

      await FlaggingService.trackIssueStatusChange('test-swarm', 123, 'blocked');

      expect(mockTrackStatus).toHaveBeenCalledWith('test-swarm', 123, 'blocked');
    });
  });
});
