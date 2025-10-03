import { DeploymentService } from './deploymentService';
import { DeploymentModel } from '../models/DeploymentModel';
import { HostModel } from '../models/HostModel';
import { SwarmModel } from '../models/SwarmModel';
import { DeploymentConfig } from '../types/deployment';
import { Client } from 'ssh2';

// Mock dependencies
jest.mock('../models/DeploymentModel');
jest.mock('../models/HostModel');
jest.mock('../models/SwarmModel');
jest.mock('ssh2');

describe('DeploymentService', () => {
  let mockDeployment: DeploymentConfig;
  let mockHost: any;
  let mockSSHClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDeployment = {
      deployment_id: 'dep_123',
      step1: { host_id: 'host_123' },
      step2: {
        github_repo: 'test-repo',
        github_owner: 'test-owner',
        github_token: 'ghp_test_token',
      },
      step3: {
        schedule_preset: 'continuous',
      },
      step4: {
        agents: [
          { role: 'developer', responsibilities: ['coding'] },
          { role: 'tester', responsibilities: ['testing'] },
        ],
      },
      step5: {
        customer_name: 'Test Customer',
        project_name: 'test-project',
        billing_rate: 150,
      },
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockHost = {
      host_id: 'host_123',
      name: 'Test Host',
      hostname: '192.168.1.100',
      port: 22,
      username: 'testuser',
      current_swarms: 2,
      capacity_max_swarms: 10,
    };

    mockSSHClient = {
      on: jest.fn(),
      connect: jest.fn(),
      exec: jest.fn(),
      sftp: jest.fn(),
      end: jest.fn(),
    };
  });

  describe('deploy', () => {
    it('should successfully deploy a swarm', async () => {
      // Mock model responses
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.update as jest.Mock).mockResolvedValue(undefined);
      (SwarmModel.create as jest.Mock).mockResolvedValue(undefined);

      // Mock SSH connection
      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      // Mock SSH exec
      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        const mockStream: any = {
          on: jest.fn((event: string, cb: Function) => {
            if (event === 'close') {
              setTimeout(() => cb(0), 0);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(),
          },
        };
        callback(null, mockStream);
      });

      // Mock SFTP upload
      mockSSHClient.sftp.mockImplementation((callback: Function) => {
        const mockSftp = {
          createWriteStream: jest.fn(() => ({
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                setTimeout(() => cb(), 0);
              }
            }),
          })),
        };
        callback(null, mockSftp);
      });

      await DeploymentService.deploy('dep_123');

      expect(DeploymentModel.getById).toHaveBeenCalledWith('dep_123');
      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'deploying');
      expect(HostModel.findById).toHaveBeenCalledWith('host_123');
      expect(SwarmModel.create).toHaveBeenCalled();
      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'deployed');
    });

    it('should throw error if deployment not found', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(null);

      await expect(DeploymentService.deploy('dep_invalid')).rejects.toThrow(
        'Deployment not found'
      );
    });

    it('should throw error if host not found', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(DeploymentService.deploy('dep_123')).rejects.toThrow('Host not found');

      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'failed');
      expect(DeploymentModel.updateProgress).toHaveBeenCalledWith('dep_123', {
        status: 'failed',
        error: 'Host not found',
      });
    });

    it('should throw error if host is at capacity', async () => {
      const fullHost = { ...mockHost, current_swarms: 10 };
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(fullHost);

      await expect(DeploymentService.deploy('dep_123')).rejects.toThrow(
        'Host has reached maximum swarm capacity'
      );

      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'failed');
    });

    it('should handle SSH connection errors', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);

      // Mock SSH connection failure
      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 0);
        }
        return mockSSHClient;
      });

      await expect(DeploymentService.deploy('dep_123')).rejects.toThrow();

      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'failed');
    });

    it('should handle SSH command execution errors', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);

      // Mock SSH connection success
      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      // Mock SSH exec failure
      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        callback(new Error('Command execution failed'));
      });

      await expect(DeploymentService.deploy('dep_123')).rejects.toThrow();

      expect(DeploymentModel.updateStatus).toHaveBeenCalledWith('dep_123', 'failed');
    });

    it('should update progress at each deployment step', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.update as jest.Mock).mockResolvedValue(undefined);
      (SwarmModel.create as jest.Mock).mockResolvedValue(undefined);

      // Mock SSH connection
      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        const mockStream: any = {
          on: jest.fn((event: string, cb: Function) => {
            if (event === 'close') {
              setTimeout(() => cb(0), 0);
            }
            return mockStream;
          }),
          stderr: { on: jest.fn() },
        };
        callback(null, mockStream);
      });

      mockSSHClient.sftp.mockImplementation((callback: Function) => {
        const mockSftp = {
          createWriteStream: jest.fn(() => ({
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                setTimeout(() => cb(), 0);
              }
            }),
          })),
        };
        callback(null, mockSftp);
      });

      await DeploymentService.deploy('dep_123');

      // Verify progress updates were called
      expect(DeploymentModel.updateProgress).toHaveBeenCalled();
      const progressCalls = (DeploymentModel.updateProgress as jest.Mock).mock.calls;

      // Check that progress percentages are increasing
      const progressPercentages = progressCalls
        .filter((call) => call[1].progress_percent !== undefined)
        .map((call) => call[1].progress_percent);

      expect(progressPercentages.length).toBeGreaterThan(5);
      expect(progressPercentages[0]).toBe(10); // First progress update
      expect(progressPercentages[progressPercentages.length - 1]).toBe(100); // Last progress
    });

    it('should increment host current_swarms count after deployment', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.update as jest.Mock).mockResolvedValue(undefined);
      (SwarmModel.create as jest.Mock).mockResolvedValue(undefined);

      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        const mockStream: any = {
          on: jest.fn((event: string, cb: Function) => {
            if (event === 'close') {
              setTimeout(() => cb(0), 0);
            }
            return mockStream;
          }),
          stderr: { on: jest.fn() },
        };
        callback(null, mockStream);
      });

      mockSSHClient.sftp.mockImplementation((callback: Function) => {
        const mockSftp = {
          createWriteStream: jest.fn(() => ({
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                setTimeout(() => cb(), 0);
              }
            }),
          })),
        };
        callback(null, mockSftp);
      });

      await DeploymentService.deploy('dep_123');

      expect(HostModel.update).toHaveBeenCalledWith({
        host_id: 'host_123',
        current_swarms: 3, // Incremented from 2 to 3
      });
    });

    it('should close SSH connection after deployment', async () => {
      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.update as jest.Mock).mockResolvedValue(undefined);
      (SwarmModel.create as jest.Mock).mockResolvedValue(undefined);

      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        const mockStream: any = {
          on: jest.fn((event: string, cb: Function) => {
            if (event === 'close') {
              setTimeout(() => cb(0), 0);
            }
            return mockStream;
          }),
          stderr: { on: jest.fn() },
        };
        callback(null, mockStream);
      });

      mockSSHClient.sftp.mockImplementation((callback: Function) => {
        const mockSftp = {
          createWriteStream: jest.fn(() => ({
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                setTimeout(() => cb(), 0);
              }
            }),
          })),
        };
        callback(null, mockSftp);
      });

      await DeploymentService.deploy('dep_123');

      expect(mockSSHClient.end).toHaveBeenCalled();
    });

    it('should use custom cron expression when provided', async () => {
      const customDeployment = {
        ...mockDeployment,
        step3: {
          cron_expression: '0 */6 * * *', // Every 6 hours
        },
      };

      (DeploymentModel.getById as jest.Mock).mockResolvedValue(customDeployment);
      (DeploymentModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.createProgress as jest.Mock).mockResolvedValue(undefined);
      (DeploymentModel.updateProgress as jest.Mock).mockResolvedValue(undefined);
      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.update as jest.Mock).mockResolvedValue(undefined);
      (SwarmModel.create as jest.Mock).mockResolvedValue(undefined);

      (Client as unknown as jest.Mock).mockImplementation(() => mockSSHClient);
      mockSSHClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSSHClient;
      });

      mockSSHClient.exec.mockImplementation((cmd: string, callback: Function) => {
        const mockStream: any = {
          on: jest.fn((event: string, cb: Function) => {
            if (event === 'close') {
              setTimeout(() => cb(0), 0);
            }
            return mockStream;
          }),
          stderr: { on: jest.fn() },
        };
        callback(null, mockStream);
      });

      let uploadedContent = '';
      mockSSHClient.sftp.mockImplementation((callback: Function) => {
        const mockSftp = {
          createWriteStream: jest.fn(() => ({
            write: jest.fn((content: string) => {
              uploadedContent += content;
            }),
            end: jest.fn(),
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                setTimeout(() => cb(), 0);
              }
            }),
          })),
        };
        callback(null, mockSftp);
      });

      await DeploymentService.deploy('dep_123');

      // Verify custom cron expression is in settings.ini
      expect(uploadedContent).toContain('cron=0 */6 * * *');
    });
  });
});
