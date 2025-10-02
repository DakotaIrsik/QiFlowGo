import { FlaggingService } from './flaggingService';
import { InterventionFlagModel } from '../models/InterventionFlagModel';

// Mock the model
jest.mock('../models/InterventionFlagModel');

describe('FlaggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('flagBlockedIssue', () => {
    it('should create a flag for blocked issue with review priority', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagBlockedIssue('swarm-1', 123, 48, 'https://github.com/test/repo/issues/123');

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
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
    it('should not flag on successful agent run', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);
      const mockTrack = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(1);

      await FlaggingService.onAgentRunComplete('swarm-1', 123, 'success');

      expect(mockTrack).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should track failure but not flag if less than 3 failures', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);
      const mockTrack = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(2);

      await FlaggingService.onAgentRunComplete(
        'swarm-1',
        123,
        'failed',
        'Agent-1',
        'Build failed'
      );

      expect(mockTrack).toHaveBeenCalledWith('swarm-1', 123, 'Agent-1', 'Build failed');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should flag issue after 3 consecutive failures', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);
      const mockTrack = jest.spyOn(InterventionFlagModel, 'trackAgentFailure').mockResolvedValue(3);

      await FlaggingService.onAgentRunComplete(
        'swarm-1',
        123,
        'failed',
        'Agent-1',
        'Build failed',
        'https://github.com/test/repo/issues/123'
      );

      expect(mockTrack).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Agent failed 3 consecutive times',
        trigger_type: 'agent_failure',
        failure_count: 3,
        agent_message: 'Build failed',
      });
    });
  });

  describe('flagSecurityVulnerability', () => {
    it('should create critical flag for security vulnerability', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagSecurityVulnerability(
        'swarm-1',
        123,
        'SQL Injection vulnerability in login endpoint',
        'HIGH',
        'https://github.com/test/repo/issues/123'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Security vulnerability detected (HIGH)',
        trigger_type: 'security_vulnerability',
        agent_message: 'SQL Injection vulnerability in login endpoint',
        metadata: {
          severity: 'HIGH',
          details: 'SQL Injection vulnerability in login endpoint',
        },
      });
    });
  });

  describe('flagTestFailures', () => {
    it('should not flag if failure rate is below threshold', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagTestFailures('swarm-1', 123, 0.05, ['test1.js']);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should flag if failure rate exceeds 10%', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagTestFailures(
        'swarm-1',
        123,
        0.15,
        ['test1.js', 'test2.js'],
        'https://github.com/test/repo/issues/123'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'review',
        reason: 'Test failure rate: 15.0%',
        trigger_type: 'test_failure',
        metadata: {
          failure_rate: 0.15,
          failed_tests: ['test1.js', 'test2.js'],
        },
      });
    });
  });

  describe('flagMergeConflict', () => {
    it('should create critical flag for merge conflict', async () => {
      const mockCreate = jest.spyOn(InterventionFlagModel, 'create').mockResolvedValue({} as any);

      await FlaggingService.flagMergeConflict(
        'swarm-1',
        123,
        ['src/auth.ts', 'src/db.ts'],
        'CONFLICT: Automatic merge failed',
        'https://github.com/test/repo/issues/123'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical',
        reason: 'Unable to resolve merge conflict',
        trigger_type: 'merge_conflict',
        agent_message: 'CONFLICT: Automatic merge failed',
        metadata: {
          conflicting_files: ['src/auth.ts', 'src/db.ts'],
        },
      });
    });
  });

  describe('trackIssueStatusChange', () => {
    it('should track status change', async () => {
      const mockTrack = jest.spyOn(InterventionFlagModel, 'trackStatusChange').mockResolvedValue();

      await FlaggingService.trackIssueStatusChange('swarm-1', 123, 'blocked');

      expect(mockTrack).toHaveBeenCalledWith('swarm-1', 123, 'blocked');
    });
  });
});
