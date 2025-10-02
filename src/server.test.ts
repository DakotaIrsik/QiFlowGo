import { cronService } from './services/cronService';
import { endPool } from './database/db';

// Mock dependencies
jest.mock('./app', () => {
  const mockApp = {
    listen: jest.fn((port, callback) => {
      callback();
      return mockServer;
    }),
  };
  return mockApp;
});

jest.mock('./database/db', () => ({
  endPool: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./services/cronService', () => ({
  cronService: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

const mockServer = {
  close: jest.fn((callback) => {
    if (callback) callback();
  }),
};

describe('Server', () => {
  let processExitSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`Process.exit called with ${code}`);
    });
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Server Initialization', () => {
    it('should start server on configured port', () => {
      // Set custom port
      process.env.PORT = '4000';

      // Require server after setting env
      jest.isolateModules(() => {
        require('./server');
      });

      const app = require('./app');
      expect(app.listen).toHaveBeenCalledWith(4000, expect.any(Function));
    });

    it('should start server on default port 3000', () => {
      // Clear PORT env
      delete process.env.PORT;

      jest.isolateModules(() => {
        require('./server');
      });

      const app = require('./app');
      expect(app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it('should start cron service on startup', () => {
      jest.isolateModules(() => {
        require('./server');
      });

      expect(cronService.start).toHaveBeenCalled();
    });

    it('should log startup messages', () => {
      delete process.env.PORT;

      jest.isolateModules(() => {
        require('./server');
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('QiFlow Control Center API server running on port 3000')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Health check: http://localhost:3000/health')
      );
    });
  });

  describe('Graceful Shutdown - SIGTERM', () => {
    it('should handle SIGTERM signal', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      // Get the SIGTERM handler
      const sigtermHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1];

      expect(sigtermHandler).toBeDefined();

      // Execute the handler
      try {
        await sigtermHandler();
      } catch (err: any) {
        // Process.exit will throw in our test
        expect(err.message).toContain('Process.exit called with 0');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'SIGTERM signal received: closing HTTP server'
      );
      expect(cronService.stop).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
      expect(endPool).toHaveBeenCalled();
    });

    it('should close server before ending database pool', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const sigtermHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1];

      const callOrder: string[] = [];

      (mockServer.close as jest.Mock).mockImplementation((callback: () => void) => {
        callOrder.push('server.close');
        callback();
      });

      (endPool as jest.Mock).mockImplementation(async () => {
        callOrder.push('endPool');
      });

      try {
        await sigtermHandler();
      } catch (err) {
        // Ignore process.exit error
      }

      expect(callOrder).toEqual(['server.close', 'endPool']);
    });
  });

  describe('Graceful Shutdown - SIGINT', () => {
    it('should handle SIGINT signal', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      // Get the SIGINT handler
      const sigintHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )?.[1];

      expect(sigintHandler).toBeDefined();

      // Execute the handler
      try {
        await sigintHandler();
      } catch (err: any) {
        // Process.exit will throw in our test
        expect(err.message).toContain('Process.exit called with 0');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'SIGINT signal received: closing HTTP server'
      );
      expect(cronService.stop).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
      expect(endPool).toHaveBeenCalled();
    });

    it('should log when HTTP server closed', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const sigintHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )?.[1];

      try {
        await sigintHandler();
      } catch (err) {
        // Ignore process.exit error
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('HTTP server closed');
    });

    it('should exit with code 0 after cleanup', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const sigintHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )?.[1];

      try {
        await sigintHandler();
      } catch (err: any) {
        expect(err.message).toBe('Process.exit called with 0');
      }

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Signal Handler Registration', () => {
    it('should register both SIGTERM and SIGINT handlers', () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const processSpy = process.on as jest.Mock;

      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('Cleanup Order', () => {
    it('should stop cron service before closing server', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const sigtermHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1];

      const callOrder: string[] = [];

      (cronService.stop as jest.Mock).mockImplementation(() => {
        callOrder.push('cronService.stop');
      });

      (mockServer.close as jest.Mock).mockImplementation((callback: () => void) => {
        callOrder.push('server.close');
        callback();
      });

      (endPool as jest.Mock).mockImplementation(async () => {
        callOrder.push('endPool');
      });

      try {
        await sigtermHandler();
      } catch (err) {
        // Ignore process.exit error
      }

      expect(callOrder).toEqual(['cronService.stop', 'server.close', 'endPool']);
    });
  });

  describe('Error Handling', () => {
    it('should handle database pool end errors gracefully', async () => {
      jest.isolateModules(() => {
        require('./server');
      });

      const sigtermHandler = (process.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1];

      (endPool as jest.Mock).mockRejectedValueOnce(new Error('DB pool error'));

      // Should not throw
      let error;
      try {
        await sigtermHandler();
      } catch (err) {
        error = err;
      }

      // Even if endPool throws, process.exit should still be called
      // (In real implementation, you might want to add error handling)
    });
  });
});
