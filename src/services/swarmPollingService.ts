import { SwarmModel } from '../models/SwarmModel';
import { SwarmHostResponse, SwarmProjectResponse } from '../types/swarm';

/**
 * Service for polling swarm hosts to fetch status
 */
export class SwarmPollingService {
  private polling: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT_MS = 5000; // 5 seconds

  /**
   * Start polling all registered swarm hosts
   */
  start(): void {
    if (this.polling) {
      console.log('Swarm polling service already running');
      return;
    }

    console.log('Starting swarm polling service...');
    this.polling = true;

    // Poll immediately, then every 30 seconds
    this.pollAllSwarms();
    this.pollingInterval = setInterval(() => {
      this.pollAllSwarms();
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop polling service
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.polling = false;
    console.log('Swarm polling service stopped');
  }

  /**
   * Poll all registered swarms
   */
  private async pollAllSwarms(): Promise<void> {
    try {
      const swarms = await SwarmModel.findAll();
      console.log(`Polling ${swarms.length} swarms...`);

      // Poll all swarms in parallel
      const results = await Promise.allSettled(
        swarms.map((swarm) => this.pollSwarm(swarm.swarm_id, swarm.host_url))
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      console.log(`Polling complete: ${successful} success, ${failed} failed`);

      // Mark stale swarms as offline (not seen in 60 seconds)
      await SwarmModel.markStaleAsOffline(60);
    } catch (error) {
      console.error('Error in pollAllSwarms:', error);
    }
  }

  /**
   * Poll a single swarm host
   */
  private async pollSwarm(swarmId: string, hostUrl: string): Promise<void> {
    try {
      // Fetch status from swarm host
      const statusData = await this.fetchWithTimeout<SwarmHostResponse>(
        `${hostUrl}/status`,
        this.REQUEST_TIMEOUT_MS
      );

      // Fetch project completion (optional, may fail)
      let projectCompletion: number | undefined;
      try {
        const projectData = await this.fetchWithTimeout<SwarmProjectResponse>(
          `${hostUrl}/project/completion`,
          this.REQUEST_TIMEOUT_MS
        );
        projectCompletion = projectData.completion;
      } catch (err) {
        // Project completion endpoint may not be available on all swarms
        console.debug(`Project completion not available for ${swarmId}`);
      }

      // Update database with latest status
      await SwarmModel.updateStatus({
        swarm_id: swarmId,
        status: this.determineStatus(statusData),
        health_status: {
          cpu_percent: statusData.cpu,
          memory_percent: statusData.memory,
          disk_percent: statusData.disk,
        },
        active_agents: statusData.agents.active,
        project_completion: projectCompletion,
      });

      console.log(`✓ Polled ${swarmId} successfully`);
    } catch (error) {
      console.error(`✗ Failed to poll ${swarmId}:`, error instanceof Error ? error.message : error);

      // Mark as offline if we can't reach it
      await SwarmModel.updateStatus({
        swarm_id: swarmId,
        status: 'offline',
      });
    }
  }

  /**
   * Fetch data from URL with timeout
   */
  private async fetchWithTimeout<T>(url: string, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Determine swarm status based on health metrics
   */
  private determineStatus(data: SwarmHostResponse): 'online' | 'degraded' | 'offline' {
    if (data.status === 'offline') {
      return 'offline';
    }

    // Consider degraded if CPU or memory above 90%
    if (data.cpu > 90 || data.memory > 90) {
      return 'degraded';
    }

    return 'online';
  }

  /**
   * Check if polling is active
   */
  isPolling(): boolean {
    return this.polling;
  }
}

// Singleton instance
export const swarmPollingService = new SwarmPollingService();
