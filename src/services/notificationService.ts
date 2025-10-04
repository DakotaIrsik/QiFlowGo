import { InterventionFlag } from '../types/interventionFlag';
import * as admin from 'firebase-admin';

/**
 * Alert types for push notifications
 */
export enum AlertType {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Alert event types
 */
export enum AlertEvent {
  SWARM_OFFLINE = 'swarm_offline',
  API_QUOTA_EXHAUSTED = 'api_quota_exhausted',
  DISK_CRITICAL = 'disk_critical',
  TEST_COVERAGE_DROP = 'test_coverage_drop',
  RATE_LIMIT_WARNING = 'rate_limit_warning',
  HIGH_RESOURCE_USAGE = 'high_resource_usage',
  MILESTONE_COMPLETED = 'milestone_completed',
  PR_MERGED = 'pr_merged',
  ISSUE_CLOSED = 'issue_closed',
  INTERVENTION_REQUIRED = 'intervention_required',
}

/**
 * Push notification service for intervention flags and swarm alerts
 * Integrates with Firebase Cloud Messaging (FCM)
 */
export class NotificationService {
  /**
   * Send a generic push notification via FCM
   */
  static async sendNotification(notification: {
    title: string;
    message: string;
    data?: any;
    tokens?: string[];
    topic?: string;
  }): Promise<void> {
    console.log('[NotificationService] Sending notification:', notification);

    try {
      // If Firebase is initialized, send via FCM
      if (admin.apps.length > 0) {
        const baseMessage = {
          notification: {
            title: notification.title,
            body: notification.message,
          },
          data: notification.data || {},
        };

        // Send to topic or tokens
        if (notification.topic) {
          await admin.messaging().send({
            ...baseMessage,
            topic: notification.topic,
          });
        } else if (notification.tokens && notification.tokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            tokens: notification.tokens,
            notification: baseMessage.notification,
            data: baseMessage.data,
          });
        }
      }
    } catch (error) {
      console.error('[NotificationService] Error sending FCM notification:', error);
      // Don't throw - notification failures shouldn't break the app
    }
  }

  /**
   * Send push notification for a new intervention flag
   */
  static async sendInterventionNotification(
    flag: InterventionFlag,
    userTokens?: string[]
  ): Promise<void> {
    const title = flag.priority === 'critical'
      ? '🔴 Critical: Human Intervention Required'
      : '🟡 Review Needed';

    const body = `Issue #${flag.issue_number}: ${flag.reason}`;

    await this.sendNotification({
      title,
      message: body,
      data: {
        type: 'intervention',
        flag_id: String(flag.id),
        swarm_id: flag.swarm_id,
        issue_number: String(flag.issue_number),
        github_url: flag.github_url || '',
        trigger_type: flag.trigger_type,
        priority: flag.priority,
      },
      tokens: userTokens,
      topic: `swarm_${flag.swarm_id}`,
    });
  }

  /**
   * Send alert notification for critical swarm events
   */
  static async sendAlertNotification(
    swarmId: string,
    alertType: AlertType,
    alertEvent: AlertEvent,
    message: string,
    userTokens?: string[]
  ): Promise<void> {
    const titleMap: Record<AlertType, string> = {
      [AlertType.CRITICAL]: '🔴 Critical Alert',
      [AlertType.WARNING]: '⚠️ Warning',
      [AlertType.INFO]: 'ℹ️ Info',
    };

    await this.sendNotification({
      title: titleMap[alertType],
      message,
      data: {
        type: 'alert',
        swarm_id: swarmId,
        alert_type: alertType,
        alert_event: alertEvent,
      },
      tokens: userTokens,
      topic: `swarm_${swarmId}`,
    });
  }

  /**
   * Send notification for multiple resolved flags
   */
  static async sendBulkResolveNotification(
    swarmId: string,
    resolvedCount: number,
    resolvedBy: string,
    userTokens?: string[]
  ): Promise<void> {
    await this.sendNotification({
      title: '✅ Interventions Resolved',
      message: `${resolvedBy} resolved ${resolvedCount} intervention flag(s)`,
      data: {
        type: 'bulk_resolve',
        swarm_id: swarmId,
        resolved_count: String(resolvedCount),
        resolved_by: resolvedBy,
      },
      tokens: userTokens,
      topic: `swarm_${swarmId}`,
    });
  }

  /**
   * Send notification when an issue status changes
   */
  static async sendStatusChangeNotification(
    swarmId: string,
    issueNumber: number,
    oldStatus: string,
    newStatus: string,
    userTokens?: string[]
  ): Promise<void> {
    await this.sendNotification({
      title: 'Issue Status Changed',
      message: `Issue #${issueNumber}: ${oldStatus} → ${newStatus}`,
      data: {
        type: 'status_change',
        swarm_id: swarmId,
        issue_number: String(issueNumber),
        old_status: oldStatus,
        new_status: newStatus,
      },
      tokens: userTokens,
      topic: `swarm_${swarmId}`,
    });
  }

  /**
   * Subscribe a device token to a swarm topic
   */
  static async subscribeToSwarm(token: string, swarmId: string): Promise<void> {
    try {
      if (admin.apps.length > 0) {
        await admin.messaging().subscribeToTopic([token], `swarm_${swarmId}`);
      }
    } catch (error) {
      console.error('[NotificationService] Error subscribing to topic:', error);
    }
  }

  /**
   * Unsubscribe a device token from a swarm topic
   */
  static async unsubscribeFromSwarm(token: string, swarmId: string): Promise<void> {
    try {
      if (admin.apps.length > 0) {
        await admin.messaging().unsubscribeFromTopic([token], `swarm_${swarmId}`);
      }
    } catch (error) {
      console.error('[NotificationService] Error unsubscribing from topic:', error);
    }
  }
}
