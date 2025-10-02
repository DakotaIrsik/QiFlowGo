import { SwarmPollingService } from './swarmPollingService';
import { SwarmModel } from '../models/SwarmModel';
import { SwarmHostResponse, SwarmProjectResponse } from '../types/swarm';

// Mock dependencies
jest.mock('../models/SwarmModel');

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('SwarmPollingService', () => {
  let service: SwarmPollingService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new SwarmPollingService();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  describe('start() and stop()', () => {
    it('should start polling service successfully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.start();

      expect(service.isPolling()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Starting swarm polling service...');

      consoleSpy.mockRestore();
    });

    it('should not start if already polling', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.start();
      service.start();

      expect(consoleSpy).toHaveBeenCalledWith('Swarm polling service already running');

      consoleSpy.mockRestore();
    });

    it('should stop polling service successfully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.start();
      service.stop();

      expect(service.isPolling()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Swarm polling service stopped');

      consoleSpy.mockRestore();
    });

    it('should poll immediately on start and then every 30 seconds', async () => {
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([]);
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(0);

      // Clear mocks after beforeEach
      jest.clearAllMocks();

      service.start();

      // Immediate poll
      await jest.runOnlyPendingTimersAsync();
      expect(SwarmModel.findAll).toHaveBeenCalledTimes(1);

      // Poll after 30 seconds
      jest.advanceTimersByTime(30000);
      await jest.runOnlyPendingTimersAsync();
      expect(SwarmModel.findAll).toHaveBeenCalledTimes(2);

      // Poll after another 30 seconds
      jest.advanceTimersByTime(30000);
      await jest.runOnlyPendingTimersAsync();
      expect(SwarmModel.findAll).toHaveBeenCalledTimes(3);
    });
  });

  describe('pollAllSwarms()', () => {
    it('should poll all registered swarms successfully', async () => {
      const mockSwarms = [
        { swarm_id: 'swarm-1', host_url: 'http://localhost:8001', name: 'Swarm 1' },
        { swarm_id: 'swarm-2', host_url: 'http://localhost:8002', name: 'Swarm 2' },
      ];

      const mockStatusResponse: SwarmHostResponse = {
        status: 'online',
        cpu: 45.5,
        memory: 60.2,
        disk: 30.0,
        agents: { active: 3, total: 4 },
      };

      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(0);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatusResponse,
      } as Response);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.start();
      await jest.runOnlyPendingTimersAsync();

      expect(SwarmModel.findAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Polling 2 swarms...');
      expect(consoleSpy).toHaveBeenCalledWith('Polling complete: 2 success, 0 failed');

      consoleSpy.mockRestore();
    });

    it('should handle polling errors gracefully', async () => {
      const mockSwarms = [
        { swarm_id: 'swarm-1', host_url: 'http://localhost:8001', name: 'Swarm 1' },
      ];

      (SwarmModel.findAll as jest.Mock).mockResolvedValue(mockSwarms);
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(0);
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Failed to poll swarm-1:'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should mark stale swarms as offline after polling', async () => {
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([]);
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(2);

      service.start();
      await jest.runOnlyPendingTimersAsync();

      expect(SwarmModel.markStaleAsOffline).toHaveBeenCalledWith(60);
    });

    it('should handle errors in findAll gracefully', async () => {
      (SwarmModel.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in pollAllSwarms:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('pollSwarm()', () => {
    it('should successfully poll a swarm and update status', async () => {
      const mockStatusResponse: SwarmHostResponse = {
        status: 'online',
        cpu: 45.5,
        memory: 60.2,
        disk: 30.0,
        agents: { active: 3, total: 4 },
      };

      const mockProjectResponse: SwarmProjectResponse = {
        completion: 75.5,
        issues: {
          open: 10,
          closed: 30,
          total: 40,
        },
      };

      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatusResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProjectResponse,
        } as Response);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Access private method via type casting
      await (service as any).pollSwarm('swarm-1', 'http://localhost:8001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/status',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );

      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: {
          cpu_percent: 45.5,
          memory_percent: 60.2,
          disk_percent: 30.0,
        },
        active_agents: 3,
        project_completion: 75.5,
      });

      expect(consoleSpy).toHaveBeenCalledWith('✓ Polled swarm-1 successfully');

      consoleSpy.mockRestore();
    });

    it('should handle missing project completion endpoint', async () => {
      const mockStatusResponse: SwarmHostResponse = {
        status: 'online',
        cpu: 20.0,
        memory: 30.0,
        disk: 40.0,
        agents: { active: 2, total: 2 },
      };

      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatusResponse,
        } as Response)
        .mockRejectedValueOnce(new Error('404 Not Found'));

      await (service as any).pollSwarm('swarm-1', 'http://localhost:8001');

      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: {
          cpu_percent: 20.0,
          memory_percent: 30.0,
          disk_percent: 40.0,
        },
        active_agents: 2,
        project_completion: undefined,
      });
    });

    it('should mark swarm as offline on fetch failure', async () => {
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await (service as any).pollSwarm('swarm-1', 'http://localhost:8001');

      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'offline',
      });
    });

    it('should mark swarm as offline on non-OK HTTP response', async () => {
      (SwarmModel.updateStatus as jest.Mock).mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await (service as any).pollSwarm('swarm-1', 'http://localhost:8001');

      expect(SwarmModel.updateStatus).toHaveBeenCalledWith({
        swarm_id: 'swarm-1',
        status: 'offline',
      });
    });
  });

  describe('determineStatus()', () => {
    it('should return offline when status is offline', () => {
      const data: SwarmHostResponse = {
        status: 'offline',
        cpu: 10,
        memory: 20,
        disk: 30,
        agents: { active: 0, total: 0 },
      };

      const result = (service as any).determineStatus(data);
      expect(result).toBe('offline');
    });

    it('should return degraded when CPU is above 90%', () => {
      const data: SwarmHostResponse = {
        status: 'online',
        cpu: 95,
        memory: 50,
        disk: 30,
        agents: { active: 3, total: 4 },
      };

      const result = (service as any).determineStatus(data);
      expect(result).toBe('degraded');
    });

    it('should return degraded when memory is above 90%', () => {
      const data: SwarmHostResponse = {
        status: 'online',
        cpu: 50,
        memory: 95,
        disk: 30,
        agents: { active: 3, total: 4 },
      };

      const result = (service as any).determineStatus(data);
      expect(result).toBe('degraded');
    });

    it('should return online when metrics are normal', () => {
      const data: SwarmHostResponse = {
        status: 'online',
        cpu: 50,
        memory: 60,
        disk: 40,
        agents: { active: 3, total: 4 },
      };

      const result = (service as any).determineStatus(data);
      expect(result).toBe('online');
    });
  });

  describe('fetchWithTimeout()', () => {
    it('should successfully fetch data within timeout', async () => {
      const mockData = { result: 'success' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await (service as any).fetchWithTimeout('http://test.com', 5000);

      expect(result).toEqual(mockData);
    });

    it('should abort fetch on timeout', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as Response), 1000))
      );

      const promise = (service as any).fetchWithTimeout('http://test.com', 100);

      jest.advanceTimersByTime(150);

      await expect(promise).rejects.toThrow();
    }, 15000);

    it('should throw error on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(
        (service as any).fetchWithTimeout('http://test.com', 5000)
      ).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('isPolling()', () => {
    it('should return false when not polling', () => {
      expect(service.isPolling()).toBe(false);
    });

    it('should return true when polling', () => {
      service.start();
      expect(service.isPolling()).toBe(true);
    });

    it('should return false after stopping', () => {
      service.start();
      service.stop();
      expect(service.isPolling()).toBe(false);
    });
  });
});
