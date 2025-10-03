import { RemoteCommandService } from './remoteCommandService';
import { sshConnectionPool } from './sshConnectionPool';
import { HostModel } from '../models/HostModel';
import { Client } from 'ssh2';

// Mock dependencies
jest.mock('./sshConnectionPool');
jest.mock('../models/HostModel');

describe('RemoteCommandService', () => {
  let service: RemoteCommandService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    service = new RemoteCommandService();
    mockClient = {
      exec: jest.fn(),
      end: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  describe('executeCommand', () => {
    const mockHost = {
      host_id: 'host-1',
      name: 'Test Host',
      hostname: '192.168.1.100',
      port: 22,
      username: 'admin',
      os_type: 'linux' as const,
      status: 'online' as const,
      last_seen: new Date(),
      ssh_key_path: '/path/to/key',
      capacity_max_swarms: 5,
      current_swarms: 2,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);
      (sshConnectionPool.releaseConnection as jest.Mock).mockReturnValue(undefined);
      (HostModel.updateLastSeen as jest.Mock).mockResolvedValue(undefined);
      (HostModel.createAuditLog as jest.Mock).mockResolvedValue({
        id: 1,
        host_id: 'host-1',
        command: 'restart_swarm',
        executed_by: 'admin',
        executed_at: new Date(),
        success: true,
      });
    });

    it('should execute a whitelisted command successfully', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 10);
            } else if (event === 'data') {
              setTimeout(() => handler(Buffer.from('Command executed')), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      const result = await service.executeCommand('host-1', 'restart_swarm', {
        executed_by: 'admin',
      });

      expect(result.success).toBe(true);
      expect(result.exit_code).toBe(0);
      expect(result.stdout).toBe('Command executed');
      expect(HostModel.updateLastSeen).toHaveBeenCalledWith('host-1', 'online');
      expect(sshConnectionPool.releaseConnection).toHaveBeenCalledWith('host-1');
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(
        service.executeCommand('host-1', 'rm -rf /', { executed_by: 'hacker' })
      ).rejects.toThrow("Command type 'rm -rf /' is not whitelisted");

      expect(mockClient.exec).not.toHaveBeenCalled();
    });

    it('should throw error if host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.executeCommand('nonexistent', 'restart_swarm')
      ).rejects.toThrow('Host not found: nonexistent');
    });

    it('should handle Windows host commands', async () => {
      const windowsHost = { ...mockHost, os_type: 'windows' as const };
      (HostModel.findById as jest.Mock).mockResolvedValue(windowsHost);

      mockClient.exec.mockImplementation((cmd, callback) => {
        expect(cmd).toContain('powershell');
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 10);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await service.executeCommand('host-1', 'restart_swarm');

      expect(mockClient.exec).toHaveBeenCalledWith(
        expect.stringContaining('powershell'),
        expect.any(Function)
      );
    });

    it('should pass input to command stdin', async () => {
      let streamMock: any;
      mockClient.exec.mockImplementation((cmd, callback) => {
        streamMock = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 10);
            }
            return streamMock;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, streamMock as any);
        return mockClient;
      });

      await service.executeCommand('host-1', 'update_settings', {
        input: 'setting1=value1\nsetting2=value2',
      });

      expect(streamMock.write).toHaveBeenCalledWith('setting1=value1\nsetting2=value2');
      expect(streamMock.end).toHaveBeenCalled();
    });

    it('should handle command execution errors', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(1), 10);
            } else if (event === 'data') {
              setTimeout(() => handler(Buffer.from('')), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn((event: string, handler: any) => {
              setTimeout(() => handler(Buffer.from('Permission denied')), 5);
              return stream.stderr;
            }),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      const result = await service.executeCommand('host-1', 'restart_swarm');

      expect(result.success).toBe(false);
      expect(result.exit_code).toBe(1);
      expect(result.stderr).toBe('Permission denied');
    });

    it('should handle SSH connection errors', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(new Error('Connection lost'), undefined as any);
        return mockClient;
      });

      await expect(
        service.executeCommand('host-1', 'restart_swarm')
      ).rejects.toThrow('Connection lost');

      expect(HostModel.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Connection lost',
        })
      );
      expect(sshConnectionPool.releaseConnection).toHaveBeenCalled();
    });

    it('should create audit log for successful execution', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 10);
            } else if (event === 'data') {
              setTimeout(() => handler(Buffer.from('Success')), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await service.executeCommand('host-1', 'check_status', {
        executed_by: 'admin',
      });

      expect(HostModel.createAuditLog).toHaveBeenCalledWith({
        host_id: 'host-1',
        command: 'check_status',
        executed_by: 'admin',
        exit_code: 0,
        output: 'Success',
        error: '',
        duration_ms: expect.any(Number),
        success: true,
      });
    });

    it('should handle stream errors', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Stream error')), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await expect(
        service.executeCommand('host-1', 'restart_swarm')
      ).rejects.toThrow('Stream error');
    });

    it('should throw error for unsupported OS command', async () => {
      const customHost = { ...mockHost, os_type: 'darwin' as any };
      (HostModel.findById as jest.Mock).mockResolvedValue(customHost);

      await expect(
        service.executeCommand('host-1', 'restart_swarm')
      ).rejects.toThrow('No command defined for restart_swarm on darwin');
    });
  });

  describe('streamLogs', () => {
    const mockHost = {
      host_id: 'host-1',
      os_type: 'linux' as const,
      hostname: '192.168.1.100',
      port: 22,
      username: 'admin',
    };

    it('should stream logs from Linux host', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);

      const onData = jest.fn();
      const onError = jest.fn();

      mockClient.exec.mockImplementation((cmd, callback) => {
        expect(cmd).toContain('tail -f');
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('Log line 1\n')), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      const cleanup = await service.streamLogs('host-1', onData, onError);

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(onData).toHaveBeenCalledWith('Log line 1\n');

      cleanup();
      expect(sshConnectionPool.closeConnection).toHaveBeenCalledWith('host-1');
    });

    it('should stream logs from Windows host', async () => {
      const windowsHost = { ...mockHost, os_type: 'windows' as const };
      (HostModel.findById as jest.Mock).mockResolvedValue(windowsHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);

      const onData = jest.fn();
      const onError = jest.fn();

      mockClient.exec.mockImplementation((cmd, callback) => {
        expect(cmd).toContain('Get-Content');
        expect(cmd).toContain('-Wait');
        const stream: any = {
          on: jest.fn().mockReturnThis(),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await service.streamLogs('host-1', onData, onError);
    });

    it('should handle host not found error', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.streamLogs('nonexistent', jest.fn(), jest.fn())
      ).rejects.toThrow('Host not found: nonexistent');
    });

    it('should handle SSH exec errors', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);

      const onData = jest.fn();
      const onError = jest.fn();

      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(new Error('SSH exec failed'), undefined as any);
        return mockClient;
      });

      await service.streamLogs('host-1', onData, onError);

      expect(onError).toHaveBeenCalledWith(new Error('SSH exec failed'));
      expect(sshConnectionPool.releaseConnection).toHaveBeenCalledWith('host-1');
    });

    it('should handle stderr from stream', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);

      const onData = jest.fn();
      const onError = jest.fn();

      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn().mockReturnThis(),
          stderr: {
            on: jest.fn((event: string, handler: any) => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from('Error message')), 5);
              }
              return stream.stderr;
            }),
          },
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await service.streamLogs('host-1', onData, onError);

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Error message',
      }));
    });

    it('should release connection on stream close', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);

      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') {
              setTimeout(() => handler(), 5);
            }
            return stream;
          }),
          stderr: {
            on: jest.fn().mockReturnThis(),
          },
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      await service.streamLogs('host-1', jest.fn(), jest.fn());

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(sshConnectionPool.releaseConnection).toHaveBeenCalledWith('host-1');
    });
  });

  describe('updateSettings', () => {
    it('should update settings with correct parameters', async () => {
      const executeCommandSpy = jest.spyOn(service, 'executeCommand').mockResolvedValue({
        success: true,
        exit_code: 0,
        stdout: 'Settings updated',
        stderr: '',
        duration_ms: 100,
      });

      const settings = 'setting1=value1\nsetting2=value2';
      await service.updateSettings('host-1', settings, 'admin');

      expect(executeCommandSpy).toHaveBeenCalledWith('host-1', 'update_settings', {
        input: settings,
        executed_by: 'admin',
      });

      executeCommandSpy.mockRestore();
    });
  });

  describe('getAvailableCommands', () => {
    it('should return available commands for Linux', () => {
      const commands = service.getAvailableCommands('linux');

      expect(commands).toContain('restart_swarm');
      expect(commands).toContain('update_settings');
      expect(commands).toContain('get_logs');
      expect(commands).toContain('check_status');
      expect(commands).toContain('stop_swarm');
      expect(commands).toContain('start_swarm');
    });

    it('should return available commands for Windows', () => {
      const commands = service.getAvailableCommands('windows');

      expect(commands).toContain('restart_swarm');
      expect(commands).toContain('update_settings');
      expect(commands).toContain('get_logs');
      expect(commands).toContain('check_status');
      expect(commands).toContain('stop_swarm');
      expect(commands).toContain('start_swarm');
    });

    it('should return all available commands', () => {
      const linuxCommands = service.getAvailableCommands('linux');
      const windowsCommands = service.getAvailableCommands('windows');

      expect(linuxCommands.length).toBeGreaterThan(0);
      expect(windowsCommands.length).toBeGreaterThan(0);
    });
  });

  describe('isCommandWhitelisted', () => {
    it('should return true for whitelisted commands', () => {
      expect(service.isCommandWhitelisted('restart_swarm')).toBe(true);
      expect(service.isCommandWhitelisted('update_settings')).toBe(true);
      expect(service.isCommandWhitelisted('get_logs')).toBe(true);
      expect(service.isCommandWhitelisted('check_status')).toBe(true);
      expect(service.isCommandWhitelisted('stop_swarm')).toBe(true);
      expect(service.isCommandWhitelisted('start_swarm')).toBe(true);
    });

    it('should return false for non-whitelisted commands', () => {
      expect(service.isCommandWhitelisted('rm -rf /')).toBe(false);
      expect(service.isCommandWhitelisted('sudo su')).toBe(false);
      expect(service.isCommandWhitelisted('random_command')).toBe(false);
      expect(service.isCommandWhitelisted('')).toBe(false);
    });
  });

  describe('command execution with different exit codes', () => {
    const mockHost = {
      host_id: 'host-1',
      os_type: 'linux' as const,
      hostname: '192.168.1.100',
      port: 22,
      username: 'admin',
    };

    beforeEach(() => {
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (sshConnectionPool.getConnection as jest.Mock).mockResolvedValue(mockClient);
      (sshConnectionPool.releaseConnection as jest.Mock).mockReturnValue(undefined);
      (HostModel.updateLastSeen as jest.Mock).mockResolvedValue(undefined);
      (HostModel.createAuditLog as jest.Mock).mockResolvedValue({});
    });

    it('should handle exit code 0 (success)', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') handler(0);
            return stream;
          }),
          stderr: { on: jest.fn().mockReturnThis() },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      const result = await service.executeCommand('host-1', 'check_status');
      expect(result.success).toBe(true);
      expect(result.exit_code).toBe(0);
    });

    it('should handle non-zero exit codes', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        const stream: any = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'close') handler(127);
            return stream;
          }),
          stderr: { on: jest.fn().mockReturnThis() },
          write: jest.fn(),
          end: jest.fn(),
        };
        callback(undefined, stream as any);
        return mockClient;
      });

      const result = await service.executeCommand('host-1', 'check_status');
      expect(result.success).toBe(false);
      expect(result.exit_code).toBe(127);
    });
  });
});
