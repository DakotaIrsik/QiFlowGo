import { SwarmModel } from '../models/SwarmModel';
import { NotificationService } from './notificationService';

/**
 * Heartbeat Monitor Service
 * Monitors swarms for missed heartbeats and triggers alerts
 */
class HeartbeatMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval: number = 30000; // Check every 30 seconds
  private heartbeatTimeout: number = 90; // Alert if no heartbeat for 90 seconds

  /**
   * Start the heartbeat monitor
   */
  start(): void {
    if (this.intervalId) {
      console.log('Heartbeat monitor is already running');
      return;
    }

    console.log('Starting heartbeat monitor...');
    this.intervalId = setInterval(() => {
      this.checkHeartbeats();
    }, this.checkInterval);

    // Run initial check
    this.checkHeartbeats();
  }

  /**
   * Stop the heartbeat monitor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Heartbeat monitor stopped');
    }
  }

  /**
   * Check for missed heartbeats and mark swarms as offline
   */
  private async checkHeartbeats(): Promise<void> {
    try {
      const staleSwarms = await SwarmModel.markStaleAsOffline(this.heartbeatTimeout);

      if (staleSwarms > 0) {
        console.log(`[ALERT] ${staleSwarms} swarm(s) marked as offline due to missed heartbeats`);

        // Get all offline swarms to send notifications
        const allSwarms = await SwarmModel.findAll();
        const offlineSwarms = allSwarms.filter(s => s.status === 'offline');

        for (const swarm of offlineSwarms) {
          // Check if this was recently updated (within last check interval)
          const lastSeenTime = new Date(swarm.last_seen).getTime();
          const now = Date.now();
          const timeSinceLastSeen = (now - lastSeenTime) / 1000;

          // Only send notification if it just went offline (within last check interval + buffer)
          if (timeSinceLastSeen >= this.heartbeatTimeout &&
              timeSinceLastSeen < this.heartbeatTimeout + (this.checkInterval / 1000) + 30) {
            await this.sendMissedHeartbeatAlert(swarm.swarm_id, swarm.name, timeSinceLastSeen);
          }
        }
      }
    } catch (error) {
      console.error('Error checking heartbeats:', error);
    }
  }

  /**
   * Send alert notification for missed heartbeat
   */
  private async sendMissedHeartbeatAlert(
    swarmId: string,
    swarmName: string,
    secondsSinceLastSeen: number
  ): Promise<void> {
    try {
      const message = `⚠️ Swarm "${swarmName}" (${swarmId}) has missed its heartbeat. Last seen ${Math.round(secondsSinceLastSeen)}s ago.`;

      await NotificationService.sendNotification({
        title: 'Swarm Offline Alert',
        message,
        data: {
          type: 'heartbeat_missed',
          swarm_id: swarmId,
          swarm_name: swarmName,
          last_seen: secondsSinceLastSeen,
        },
      });

      console.log(`[ALERT] Sent missed heartbeat notification for swarm ${swarmId}`);
    } catch (error) {
      console.error(`Error sending missed heartbeat alert for swarm ${swarmId}:`, error);
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): { running: boolean; checkInterval: number; heartbeatTimeout: number } {
    return {
      running: this.intervalId !== null,
      checkInterval: this.checkInterval,
      heartbeatTimeout: this.heartbeatTimeout,
    };
  }
}

export const heartbeatMonitor = new HeartbeatMonitor();
