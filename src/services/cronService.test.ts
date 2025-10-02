import { CronService } from './cronService';
import { FlaggingService } from './flaggingService';

// Mock the FlaggingService
jest.mock('./flaggingService');

describe('CronService', () => {
  let cronService: CronService;
  let mockCheckBlockedIssues: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    cronService = new CronService();
    mockCheckBlockedIssues = FlaggingService.checkBlockedIssues as jest.Mock;
  });

  afterEach(() => {
    cronService.stop();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should run checks immediately on startup', async () => {
      mockCheckBlockedIssues.mockResolvedValue(3);

      cronService.start();

      // Wait for the immediate execution to complete
      await Promise.resolve();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);
    });

    it('should schedule hourly checks', async () => {
      mockCheckBlockedIssues.mockResolvedValue(2);

      cronService.start();

      // Wait for immediate execution
      await Promise.resolve();

      // Clear the initial call
      mockCheckBlockedIssues.mockClear();

      // Fast-forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);

      // Fast-forward another hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(2);
    });

    it('should log the number of flagged issues', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockCheckBlockedIssues.mockResolvedValue(5);

      cronService.start();
      await Promise.resolve();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Flagged 5 issues')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Flagging service error');
      mockCheckBlockedIssues.mockRejectedValue(error);

      cronService.start();
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CronService] Error during hourly checks:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop the scheduled checks', () => {
      mockCheckBlockedIssues.mockResolvedValue(1);

      cronService.start();
      cronService.stop();

      mockCheckBlockedIssues.mockClear();

      // Fast-forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);

      // Should not have been called since we stopped
      expect(mockCheckBlockedIssues).not.toHaveBeenCalled();
    });

    it('should log when stopping', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      cronService.start();
      cronService.stop();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CronService] Stopped hourly intervention checks'
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle being called when not running', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Stop without starting
      cronService.stop();

      // Should not crash or log
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should allow restarting after stop', async () => {
      mockCheckBlockedIssues.mockResolvedValue(2);

      cronService.start();
      await Promise.resolve();

      cronService.stop();
      mockCheckBlockedIssues.mockClear();

      cronService.start();
      await Promise.resolve();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerCheck', () => {
    it('should manually trigger a check', async () => {
      mockCheckBlockedIssues.mockResolvedValue(4);

      await cronService.triggerCheck();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during manual trigger', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Manual trigger error');
      mockCheckBlockedIssues.mockRejectedValue(error);

      await cronService.triggerCheck();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CronService] Error during hourly checks:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should work independently of scheduled checks', async () => {
      mockCheckBlockedIssues.mockResolvedValue(3);

      cronService.start();
      await Promise.resolve();

      mockCheckBlockedIssues.mockClear();

      // Trigger manual check
      await cronService.triggerCheck();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple start calls', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockCheckBlockedIssues.mockResolvedValue(1);

      cronService.start();
      await Promise.resolve();

      const callCount = mockCheckBlockedIssues.mock.calls.length;

      // Try to start again
      cronService.start();
      await Promise.resolve();

      // Should have run twice now (once per start)
      expect(mockCheckBlockedIssues.mock.calls.length).toBeGreaterThan(callCount);

      consoleLogSpy.mockRestore();
    });

    it('should handle zero flagged issues', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockCheckBlockedIssues.mockResolvedValue(0);

      cronService.start();
      await Promise.resolve();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Flagged 0 issues')
      );

      consoleLogSpy.mockRestore();
    });

    it('should maintain correct interval timing', async () => {
      mockCheckBlockedIssues.mockResolvedValue(1);

      cronService.start();
      await Promise.resolve();

      mockCheckBlockedIssues.mockClear();

      // Fast-forward just under 1 hour
      jest.advanceTimersByTime(59 * 60 * 1000);
      await Promise.resolve();

      expect(mockCheckBlockedIssues).not.toHaveBeenCalled();

      // Fast-forward the remaining time
      jest.advanceTimersByTime(60 * 1000);
      await Promise.resolve();

      expect(mockCheckBlockedIssues).toHaveBeenCalledTimes(1);
    });

    it('should handle async errors in checkBlockedIssues', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCheckBlockedIssues.mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      cronService.start();
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton cronService instance', () => {
      const { cronService: singleton } = require('./cronService');
      expect(singleton).toBeInstanceOf(CronService);
    });
  });
});
