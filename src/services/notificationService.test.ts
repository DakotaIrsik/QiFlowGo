import { NotificationService } from './notificationService';

describe('NotificationService', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('sendInterventionNotification', () => {
    it('should send critical notification with correct format', async () => {
      const flag = {
        id: 1,
        swarm_id: 'test-swarm',
        issue_number: 123,
        github_url: 'https://github.com/test/repo/issues/123',
        priority: 'critical' as const,
        reason: 'Agent failed 3 consecutive times',
        trigger_type: 'agent_failure' as const,
        flagged_at: new Date(),
      };

      await NotificationService.sendInterventionNotification(flag);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          swarm_id: 'test-swarm',
          title: '🔴 Critical: Human Intervention Required',
          body: 'Issue #123: Agent failed 3 consecutive times',
          priority: 'high',
          data: expect.objectContaining({
            type: 'intervention',
            flag_id: 1,
            issue_number: 123,
          }),
        })
      );
    });

    it('should send review notification with correct format', async () => {
      const flag = {
        id: 2,
        swarm_id: 'test-swarm',
        issue_number: 456,
        priority: 'review' as const,
        reason: 'Test failure rate: 15.0%',
        trigger_type: 'test_failure' as const,
        flagged_at: new Date(),
      };

      await NotificationService.sendInterventionNotification(flag);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: '🟡 Review Needed',
          priority: 'normal',
        })
      );
    });
  });

  describe('sendBulkResolveNotification', () => {
    it('should send notification for bulk resolve', async () => {
      await NotificationService.sendBulkResolveNotification('test-swarm', 5, 'admin@test.com');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending bulk resolve notification:',
        expect.objectContaining({
          swarm_id: 'test-swarm',
          title: '✅ Interventions Resolved',
          body: 'admin@test.com resolved 5 intervention flag(s)',
        })
      );
    });
  });

  describe('sendStatusChangeNotification', () => {
    it('should send notification for status change', async () => {
      await NotificationService.sendStatusChangeNotification('test-swarm', 123, 'in_progress', 'blocked');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending status change notification:',
        expect.objectContaining({
          swarm_id: 'test-swarm',
          title: 'Issue Status Changed',
          body: 'Issue #123: in_progress → blocked',
        })
      );
    });
  });
});
