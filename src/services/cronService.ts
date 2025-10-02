import { FlaggingService } from './flaggingService';

/**
 * Background job scheduler for intervention flagging
 * Runs hourly checks for blocked issues
 */
export class CronService {
  private intervalId?: NodeJS.Timeout;
  private readonly HOUR_IN_MS = 60 * 60 * 1000;

  /**
   * Start the cron service
   */
  start(): void {
    console.log('[CronService] Starting hourly intervention checks...');

    // Run immediately on startup
    this.runHourlyChecks();

    // Schedule to run every hour
    this.intervalId = setInterval(() => {
      this.runHourlyChecks();
    }, this.HOUR_IN_MS);
  }

  /**
   * Stop the cron service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[CronService] Stopped hourly intervention checks');
    }
  }

  /**
   * Execute hourly checks
   */
  private async runHourlyChecks(): Promise<void> {
    try {
      console.log(`[CronService] Running hourly checks at ${new Date().toISOString()}`);

      const flaggedCount = await FlaggingService.checkBlockedIssues();

      console.log(`[CronService] Hourly check complete. Flagged ${flaggedCount} issues.`);
    } catch (error) {
      console.error('[CronService] Error during hourly checks:', error);
    }
  }

  /**
   * Manually trigger a check (for testing/debugging)
   */
  async triggerCheck(): Promise<void> {
    await this.runHourlyChecks();
  }
}

// Singleton instance
export const cronService = new CronService();
