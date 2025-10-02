import request from 'supertest';
import express from 'express';
import hostRoutes from './hostRoutes';
import { HostModel } from '../models/HostModel';
import { remoteCommandService } from '../services/remoteCommandService';
import { sshConnectionPool } from '../services/sshConnectionPool';

// Mock dependencies
jest.mock('../models/HostModel');
jest.mock('../services/remoteCommandService');
jest.mock('../services/sshConnectionPool');

const app = express();
app.use(express.json());
app.use('/api/v1', hostRoutes);

describe('Host Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/hosts', () => {
    it('should return all hosts', async () => {
      const mockHosts = [
        {
          host_id: 'host-1',
          name: 'Production Server',
          hostname: 'prod.example.com',
          port: 22,
          username: 'deploy',
          os_type: 'linux',
          status: 'online',
          last_seen: '2025-10-02T10:00:00Z',
          ssh_key_path: null,
          capacity_max_swarms: 5,
          current_swarms: 2,
          metadata: null,
          created_at: '2025-10-01T00:00:00Z',
          updated_at: '2025-10-02T10:00:00Z',
        },
      ];

      (HostModel.findAll as jest.Mock).mockResolvedValue(mockHosts);

      const response = await request(app).get('/api/v1/hosts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHosts);
    });

    it('should handle errors', async () => {
      (HostModel.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/hosts');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/hosts/available', () => {
    it('should return hosts with available capacity', async () => {
      const mockHosts = [
        {
          host_id: 'host-1',
          name: 'Server 1',
          capacity_max_swarms: 10,
          current_swarms: 3,
          status: 'online',
        },
      ];

      (HostModel.findAvailable as jest.Mock).mockResolvedValue(mockHosts);

      const response = await request(app).get('/api/v1/hosts/available');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHosts);
    });
  });

  describe('GET /api/v1/hosts/:host_id', () => {
    it('should return a specific host', async () => {
      const mockHost = {
        host_id: 'host-1',
        name: 'Production Server',
        hostname: 'prod.example.com',
        port: 22,
        username: 'deploy',
        os_type: 'linux',
        status: 'online',
      };

      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);

      const response = await request(app).get('/api/v1/hosts/host-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHost);
    });

    it('should return 404 when host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/hosts/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/hosts', () => {
    it('should create a new host', async () => {
      const newHost = {
        host_id: 'host-1',
        name: 'Production Server',
        hostname: 'prod.example.com',
        username: 'deploy',
        os_type: 'linux',
      };

      const mockCreatedHost = {
        ...newHost,
        port: 22,
        status: 'offline',
        last_seen: null,
        ssh_key_path: null,
        capacity_max_swarms: 5,
        current_swarms: 0,
        metadata: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-02T10:00:00Z',
      };

      (HostModel.create as jest.Mock).mockResolvedValue(mockCreatedHost);

      const response = await request(app).post('/api/v1/hosts').send(newHost);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedHost);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app).post('/api/v1/hosts').send({
        name: 'Incomplete Host',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid os_type', async () => {
      const response = await request(app).post('/api/v1/hosts').send({
        host_id: 'host-1',
        name: 'Test Host',
        hostname: 'test.example.com',
        username: 'deploy',
        os_type: 'invalid',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('os_type must be');
    });
  });

  describe('PATCH /api/v1/hosts/:host_id', () => {
    it('should update a host', async () => {
      const updates = {
        status: 'online',
        current_swarms: 3,
      };

      const mockUpdatedHost = {
        host_id: 'host-1',
        name: 'Production Server',
        status: 'online',
        current_swarms: 3,
      };

      (HostModel.update as jest.Mock).mockResolvedValue(mockUpdatedHost);

      const response = await request(app).patch('/api/v1/hosts/host-1').send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedHost);
    });

    it('should return 404 when host not found', async () => {
      (HostModel.update as jest.Mock).mockResolvedValue(null);

      const response = await request(app).patch('/api/v1/hosts/non-existent').send({
        status: 'online',
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/hosts/:host_id', () => {
    it('should delete a host', async () => {
      (HostModel.delete as jest.Mock).mockResolvedValue(true);
      (sshConnectionPool.closeConnection as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/api/v1/hosts/host-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(sshConnectionPool.closeConnection).toHaveBeenCalledWith('host-1');
    });

    it('should return 404 when host not found', async () => {
      (HostModel.delete as jest.Mock).mockResolvedValue(false);

      const response = await request(app).delete('/api/v1/hosts/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/hosts/:host_id/test-connection', () => {
    it('should test connection successfully', async () => {
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(true);
      (HostModel.updateLastSeen as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).post('/api/v1/hosts/host-1/test-connection');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
      expect(HostModel.updateLastSeen).toHaveBeenCalledWith('host-1', 'online');
    });

    it('should handle connection failure', async () => {
      (sshConnectionPool.testConnection as jest.Mock).mockResolvedValue(false);

      const response = await request(app).post('/api/v1/hosts/host-1/test-connection');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(false);
    });
  });

  describe('POST /api/v1/hosts/:host_id/commands/:command_type', () => {
    it('should execute a whitelisted command', async () => {
      const mockResult = {
        success: true,
        exit_code: 0,
        stdout: 'Command executed successfully',
        stderr: '',
        duration_ms: 1500,
      };

      (remoteCommandService.isCommandWhitelisted as jest.Mock).mockReturnValue(true);
      (remoteCommandService.executeCommand as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/hosts/host-1/commands/restart_swarm')
        .send({ executed_by: 'admin@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(remoteCommandService.executeCommand).toHaveBeenCalledWith(
        'host-1',
        'restart_swarm',
        expect.objectContaining({ executed_by: 'admin@example.com' })
      );
    });

    it('should reject non-whitelisted commands', async () => {
      (remoteCommandService.isCommandWhitelisted as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/api/v1/hosts/host-1/commands/malicious_command')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not whitelisted');
    });

    it('should handle command execution errors', async () => {
      (remoteCommandService.isCommandWhitelisted as jest.Mock).mockReturnValue(true);
      (remoteCommandService.executeCommand as jest.Mock).mockRejectedValue(
        new Error('SSH connection failed')
      );

      const response = await request(app)
        .post('/api/v1/hosts/host-1/commands/restart_swarm')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/hosts/:host_id/audit-logs', () => {
    it('should return audit logs for a host', async () => {
      const mockLogs = [
        {
          id: 1,
          host_id: 'host-1',
          command: 'restart_swarm',
          executed_by: 'admin@example.com',
          executed_at: '2025-10-02T10:00:00Z',
          exit_code: 0,
          output: 'Success',
          error: null,
          duration_ms: 1500,
          success: true,
          metadata: null,
        },
      ];

      (HostModel.getAuditLogs as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app).get('/api/v1/hosts/host-1/audit-logs?limit=50');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLogs);
      expect(HostModel.getAuditLogs).toHaveBeenCalledWith('host-1', 50);
    });
  });

  describe('GET /api/v1/hosts/:host_id/available-commands', () => {
    it('should return available commands for a host', async () => {
      const mockHost = {
        host_id: 'host-1',
        os_type: 'linux',
      };

      const mockCommands = ['restart_swarm', 'update_settings', 'get_logs', 'check_status'];

      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (remoteCommandService.getAvailableCommands as jest.Mock).mockReturnValue(mockCommands);

      const response = await request(app).get('/api/v1/hosts/host-1/available-commands');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available_commands).toEqual(mockCommands);
      expect(remoteCommandService.getAvailableCommands).toHaveBeenCalledWith('linux');
    });

    it('should return 404 when host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/hosts/non-existent/available-commands');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
