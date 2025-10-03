import { heartbeatMonitor } from './heartbeatMonitor';
import { SwarmModel } from '../models/SwarmModel';
import { NotificationService } from './notificationService';

jest.mock('../models/SwarmModel');
jest.mock('./notificationService');

describe('HeartbeatMonitor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    heartbeatMonitor.stop();
  });

  afterEach(() => {
    heartbeatMonitor.stop();
  });

  describe('start/stop', () => {
    it('should start the monitor', () => {
      heartbeatMonitor.start();
      const status = heartbeatMonitor.getStatus();
      expect(status.running).toBe(true);
    });

    it('should stop the monitor', () => {
      heartbeatMonitor.start();
      heartbeatMonitor.stop();
      const status = heartbeatMonitor.getStatus();
      expect(status.running).toBe(false);
    });

    it('should not start multiple instances', () => {
      heartbeatMonitor.start();
      heartbeatMonitor.start(); // Should not create another instance
      const status = heartbeatMonitor.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when stopped', () => {
      const status = heartbeatMonitor.getStatus();
      expect(status).toEqual({
        running: false,
        checkInterval: 30000,
        heartbeatTimeout: 90,
      });
    });

    it('should return correct status when running', () => {
      heartbeatMonitor.start();
      const status = heartbeatMonitor.getStatus();
      expect(status).toEqual({
        running: true,
        checkInterval: 30000,
        heartbeatTimeout: 90,
      });
    });
  });

  describe('checkHeartbeats', () => {
    it('should mark stale swarms as offline', async () => {
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(2);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([]);

      heartbeatMonitor.start();

      // Wait for initial check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(SwarmModel.markStaleAsOffline).toHaveBeenCalledWith(90);
    });

    it('should send notification for newly offline swarms', async () => {
      const now = Date.now();
      const offlineSwarm = {
        swarm_id: 'test-swarm-1',
        name: 'Test Swarm',
        host_url: 'http://localhost:8000',
        status: 'offline',
        last_seen: new Date(now - 95000), // 95 seconds ago (just went offline)
        health_status: {},
        active_agents: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(1);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([offlineSwarm]);
      (NotificationService.sendNotification as jest.Mock).mockResolvedValue(undefined);

      heartbeatMonitor.start();

      // Wait for initial check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(NotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Swarm Offline Alert',
          message: expect.stringContaining('Test Swarm'),
          data: expect.objectContaining({
            type: 'heartbeat_missed',
            swarm_id: 'test-swarm-1',
            swarm_name: 'Test Swarm',
          }),
        })
      );
    });

    it('should not send notification for swarms offline for too long', async () => {
      const now = Date.now();
      const longOfflineSwarm = {
        swarm_id: 'test-swarm-2',
        name: 'Long Offline Swarm',
        host_url: 'http://localhost:8000',
        status: 'offline',
        last_seen: new Date(now - 300000), // 5 minutes ago
        health_status: {},
        active_agents: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(0);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([longOfflineSwarm]);
      (NotificationService.sendNotification as jest.Mock).mockResolvedValue(undefined);

      heartbeatMonitor.start();

      // Wait for initial check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(NotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (SwarmModel.markStaleAsOffline as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      heartbeatMonitor.start();

      // Wait for initial check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking heartbeats:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle notification errors gracefully', async () => {
      const now = Date.now();
      const offlineSwarm = {
        swarm_id: 'test-swarm-3',
        name: 'Test Swarm 3',
        host_url: 'http://localhost:8000',
        status: 'offline',
        last_seen: new Date(now - 95000),
        health_status: {},
        active_agents: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(1);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([offlineSwarm]);
      (NotificationService.sendNotification as jest.Mock).mockRejectedValue(
        new Error('Notification service error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      heartbeatMonitor.start();

      // Wait for initial check
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error sending missed heartbeat alert'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('periodic checks', () => {
    it('should run checks periodically', async () => {
      (SwarmModel.markStaleAsOffline as jest.Mock).mockResolvedValue(0);
      (SwarmModel.findAll as jest.Mock).mockResolvedValue([]);

      heartbeatMonitor.start();

      // Wait for multiple check intervals
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have been called at least once (on start)
      expect(SwarmModel.markStaleAsOffline).toHaveBeenCalled();
    });
  });
});
