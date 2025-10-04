import { NotificationService, AlertType, AlertEvent } from './notificationService';
import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  apps: [],
  messaging: jest.fn(() => ({
    send: jest.fn(),
    sendEachForMulticast: jest.fn(),
    subscribeToTopic: jest.fn(),
    unsubscribeFromTopic: jest.fn(),
  })),
}));

describe('NotificationService', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('sendNotification', () => {
    it('should log notification when Firebase is not initialized', async () => {
      await NotificationService.sendNotification({
        title: 'Test',
        message: 'Test message',
        data: { test: 'data' },
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: 'Test',
          message: 'Test message',
        })
      );
    });
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
          title: '🔴 Critical: Human Intervention Required',
          message: 'Issue #123: Agent failed 3 consecutive times',
          data: expect.objectContaining({
            type: 'intervention',
            flag_id: '1',
            issue_number: '123',
            swarm_id: 'test-swarm',
          }),
          topic: 'swarm_test-swarm',
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
          message: 'Issue #456: Test failure rate: 15.0%',
        })
      );
    });
  });

  describe('sendAlertNotification', () => {
    it('should send critical alert', async () => {
      await NotificationService.sendAlertNotification(
        'test-swarm',
        AlertType.CRITICAL,
        AlertEvent.SWARM_OFFLINE,
        'Swarm has gone offline'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: '🔴 Critical Alert',
          message: 'Swarm has gone offline',
          data: expect.objectContaining({
            type: 'alert',
            swarm_id: 'test-swarm',
            alert_type: AlertType.CRITICAL,
            alert_event: AlertEvent.SWARM_OFFLINE,
          }),
        })
      );
    });

    it('should send warning alert', async () => {
      await NotificationService.sendAlertNotification(
        'test-swarm',
        AlertType.WARNING,
        AlertEvent.HIGH_RESOURCE_USAGE,
        'CPU usage at 85%'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: '⚠️ Warning',
          message: 'CPU usage at 85%',
        })
      );
    });

    it('should send info alert', async () => {
      await NotificationService.sendAlertNotification(
        'test-swarm',
        AlertType.INFO,
        AlertEvent.PR_MERGED,
        'PR #42 merged successfully'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: 'ℹ️ Info',
          message: 'PR #42 merged successfully',
        })
      );
    });
  });

  describe('sendBulkResolveNotification', () => {
    it('should send notification for bulk resolve', async () => {
      await NotificationService.sendBulkResolveNotification('test-swarm', 5, 'admin@test.com');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: '✅ Interventions Resolved',
          message: 'admin@test.com resolved 5 intervention flag(s)',
          data: expect.objectContaining({
            type: 'bulk_resolve',
            swarm_id: 'test-swarm',
            resolved_count: '5',
          }),
        })
      );
    });
  });

  describe('sendStatusChangeNotification', () => {
    it('should send notification for status change', async () => {
      await NotificationService.sendStatusChangeNotification('test-swarm', 123, 'in_progress', 'blocked');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[NotificationService] Sending notification:',
        expect.objectContaining({
          title: 'Issue Status Changed',
          message: 'Issue #123: in_progress → blocked',
          data: expect.objectContaining({
            type: 'status_change',
            swarm_id: 'test-swarm',
            issue_number: '123',
          }),
        })
      );
    });
  });

  describe('subscribeToSwarm', () => {
    it('should handle subscription when Firebase not initialized', async () => {
      await NotificationService.subscribeToSwarm('test-token', 'test-swarm');
      // Should not throw and not call Firebase
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromSwarm', () => {
    it('should handle unsubscription when Firebase not initialized', async () => {
      await NotificationService.unsubscribeFromSwarm('test-token', 'test-swarm');
      // Should not throw and not call Firebase
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
