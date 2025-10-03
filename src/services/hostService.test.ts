import { hostService } from './hostService';
import { HostModel } from '../models/HostModel';
import { sshConnectionPool } from './sshConnectionPool';
import { remoteCommandService } from './remoteCommandService';

// Mock dependencies
jest.mock('../models/HostModel');
jest.mock('./sshConnectionPool');
jest.mock('./remoteCommandService');

describe('HostService', () => {
  const mockHost = {
    host_id: 'host-123',
    name: 'Test Host',
    hostname: '192.168.1.100',
    port: 22,
    username: 'admin',
    os_type: 'linux' as const,
    status: 'online' as const,
    last_seen: new Date(),
    ssh_key_path: '/path/to/key',
    capacity_max_swarms: 5,
    current_swarms: 0,
    metadata: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerHost', () => {
    it('should register a new host successfully', async () => {
      const createParams = {
        name: 'Test Host',
        hostname: '192.168.1.100',
        username: 'admin',
        os_type: 'linux' as const,
      };

      (HostModel.create as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(true);

      const result = await hostService.registerHost(createParams);

      expect(HostModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createParams,
          host_id: expect.any(String),
        })
      );
      expect(sshConnectionPool.testConnection).toHaveBeenCalled();
      expect(HostModel.updateLastSeen).toHaveBeenCalledWith(expect.any(String), 'online');
      expect(result).toEqual(mockHost);
    });

    it('should throw error for missing required fields', async () => {
      const invalidParams = {
        name: '',
        hostname: '192.168.1.100',
        username: 'admin',
        os_type: 'linux' as const,
      };

      await expect(hostService.registerHost(invalidParams)).rejects.toThrow(
        'Missing required fields: name, hostname, username'
      );
    });

    it('should mark host as offline if connection test fails', async () => {
      const createParams = {
        name: 'Test Host',
        hostname: '192.168.1.100',
        username: 'admin',
        os_type: 'linux' as const,
      };

      (HostModel.create as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(false);

      await hostService.registerHost(createParams);

      expect(HostModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'offline' })
      );
    });
  });

  describe('getAllHosts', () => {
    it('should return all hosts', async () => {
      const mockHosts = [mockHost];
      (HostModel.findAll as jest.Mock).mockResolvedValue(mockHosts);

      const result = await hostService.getAllHosts();

      expect(HostModel.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockHosts);
    });
  });

  describe('getHostById', () => {
    it('should return a host by ID', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);

      const result = await hostService.getHostById('host-123');

      expect(HostModel.findById).toHaveBeenCalledWith('host-123');
      expect(result).toEqual(mockHost);
    });

    it('should return null if host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await hostService.getHostById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateHost', () => {
    it('should update host information', async () => {
      const updates = { name: 'Updated Name' };
      (HostModel.update as jest.Mock).mockResolvedValue({ ...mockHost, ...updates });

      const result = await hostService.updateHost('host-123', updates);

      expect(HostModel.update).toHaveBeenCalledWith({
        host_id: 'host-123',
        ...updates,
      });
      expect(result?.name).toBe('Updated Name');
    });
  });

  describe('removeHost', () => {
    it('should remove a host and close SSH connection', async () => {
      (HostModel.delete as jest.Mock).mockResolvedValue(true);

      const result = await hostService.removeHost('host-123');

      expect(sshConnectionPool.closeConnection).toHaveBeenCalledWith('host-123');
      expect(HostModel.delete).toHaveBeenCalledWith('host-123');
      expect(result).toBe(true);
    });
  });

  describe('executeCommand', () => {
    it('should execute a remote command successfully', async () => {
      const mockResult = {
        success: true,
        exit_code: 0,
        stdout: 'Command output',
        stderr: '',
        duration_ms: 100,
      };

      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (remoteCommandService.executeCommand as jest.Mock).mockResolvedValue(mockResult);

      const result = await hostService.executeCommand('host-123', 'check_status', {
        executed_by: 'admin',
      });

      expect(HostModel.findById).toHaveBeenCalledWith('host-123');
      expect(remoteCommandService.executeCommand).toHaveBeenCalledWith(
        'host-123',
        'check_status',
        { executed_by: 'admin' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error if host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        hostService.executeCommand('nonexistent', 'check_status')
      ).rejects.toThrow('Host not found: nonexistent');
    });
  });

  describe('getAvailableHosts', () => {
    it('should return hosts with available capacity', async () => {
      const availableHosts = [mockHost];
      (HostModel.findAvailable as jest.Mock).mockResolvedValue(availableHosts);

      const result = await hostService.getAvailableHosts();

      expect(HostModel.findAvailable).toHaveBeenCalled();
      expect(result).toEqual(availableHosts);
    });
  });

  describe('checkHostHealth', () => {
    it('should return healthy status if connection succeeds', async () => {
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(true);

      const result = await hostService.checkHostHealth('host-123');

      expect(sshConnectionPool.testConnection).toHaveBeenCalledWith('host-123');
      expect(HostModel.updateLastSeen).toHaveBeenCalledWith('host-123', 'online');
      expect(result).toEqual({
        healthy: true,
        message: 'Host is online and reachable',
      });
    });

    it('should return unhealthy status if connection fails', async () => {
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(false);

      const result = await hostService.checkHostHealth('host-123');

      expect(HostModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'offline' })
      );
      expect(result).toEqual({
        healthy: false,
        message: 'Host is unreachable',
      });
    });

    it('should return error status if connection throws error', async () => {
      const errorMessage = 'Connection timeout';
      (sshConnectionPool.testConnection as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await hostService.checkHostHealth('host-123');

      expect(HostModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' })
      );
      expect(result).toEqual({
        healthy: false,
        message: errorMessage,
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs for a host', async () => {
      const mockLogs = [
        {
          id: 1,
          host_id: 'host-123',
          command: 'check_status',
          executed_by: 'admin',
          executed_at: new Date(),
          exit_code: 0,
          output: 'OK',
          error: null,
          duration_ms: 100,
          success: true,
          metadata: null,
        },
      ];

      (HostModel.getAuditLogs as jest.Mock).mockResolvedValue(mockLogs);

      const result = await hostService.getAuditLogs('host-123', 50);

      expect(HostModel.getAuditLogs).toHaveBeenCalledWith('host-123', 50);
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getAvailableCommands', () => {
    it('should return available commands for a host', async () => {
      const mockCommands = ['check_status', 'restart_swarm', 'stop_swarm'];
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (remoteCommandService.getAvailableCommands as jest.Mock).mockReturnValue(mockCommands);

      const result = await hostService.getAvailableCommands('host-123');

      expect(HostModel.findById).toHaveBeenCalledWith('host-123');
      expect(remoteCommandService.getAvailableCommands).toHaveBeenCalledWith('linux');
      expect(result).toEqual(mockCommands);
    });

    it('should throw error if host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(hostService.getAvailableCommands('nonexistent')).rejects.toThrow(
        'Host not found: nonexistent'
      );
    });
  });

  describe('updateRemoteSettings', () => {
    it('should update settings on a remote host', async () => {
      const settingsContent = 'setting1=value1\nsetting2=value2';
      const mockResult = {
        success: true,
        exit_code: 0,
        stdout: 'Settings updated',
        stderr: '',
        duration_ms: 200,
      };

      (remoteCommandService.updateSettings as jest.Mock).mockResolvedValue(mockResult);

      const result = await hostService.updateRemoteSettings(
        'host-123',
        settingsContent,
        'admin'
      );

      expect(remoteCommandService.updateSettings).toHaveBeenCalledWith(
        'host-123',
        settingsContent,
        'admin'
      );
      expect(result).toEqual(mockResult);
    });
  });
});
