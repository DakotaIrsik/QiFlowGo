import request from 'supertest';
import express from 'express';
import hostRoutes from './hostRoutes';
import { hostService } from '../services/hostService';

// Mock dependencies
jest.mock('../services/hostService');

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

      (hostService.getAllHosts as jest.Mock).mockResolvedValue(mockHosts);

      const response = await request(app).get('/api/v1/hosts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHosts);
    });

    it('should handle errors', async () => {
      (hostService.getAllHosts as jest.Mock).mockRejectedValue(new Error('Database error'));

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

      (hostService.getAvailableHosts as jest.Mock).mockResolvedValue(mockHosts);

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

      (hostService.getHostById as jest.Mock).mockResolvedValue(mockHost);

      const response = await request(app).get('/api/v1/hosts/host-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHost);
    });

    it('should return 404 when host not found', async () => {
      (hostService.getHostById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/hosts/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/hosts', () => {
    it('should create a new host', async () => {
      const newHost = {
        name: 'Production Server',
        hostname: 'prod.example.com',
        username: 'deploy',
        os_type: 'linux',
      };

      const mockCreatedHost = {
        host_id: 'host-1',
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

      (hostService.registerHost as jest.Mock).mockResolvedValue(mockCreatedHost);

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
    });

    it('should return 400 for invalid os_type', async () => {
      const response = await request(app).post('/api/v1/hosts').send({
        name: 'Test Host',
        hostname: 'test.example.com',
        username: 'deploy',
        os_type: 'macos',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/hosts/:host_id', () => {
    it('should update a host', async () => {
      const mockUpdatedHost = {
        host_id: 'host-1',
        name: 'Updated Server',
        hostname: 'updated.example.com',
        port: 22,
        username: 'deploy',
        os_type: 'linux',
        status: 'online',
      };

      (hostService.updateHost as jest.Mock).mockResolvedValue(mockUpdatedHost);

      const response = await request(app).patch('/api/v1/hosts/host-1').send({
        name: 'Updated Server',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedHost);
    });

    it('should return 404 when host not found', async () => {
      (hostService.updateHost as jest.Mock).mockResolvedValue(null);

      const response = await request(app).patch('/api/v1/hosts/non-existent').send({
        name: 'Updated Name',
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/hosts/:host_id', () => {
    it('should delete a host', async () => {
      (hostService.removeHost as jest.Mock).mockResolvedValue(true);

      const response = await request(app).delete('/api/v1/hosts/host-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Host deleted successfully');
    });

    it('should return 404 when host not found', async () => {
      (hostService.removeHost as jest.Mock).mockResolvedValue(false);

      const response = await request(app).delete('/api/v1/hosts/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/hosts/:host_id/health', () => {
    it('should check host health successfully', async () => {
      (hostService.checkHostHealth as jest.Mock).mockResolvedValue({
        healthy: true,
        message: 'Host is online and reachable',
      });

      const response = await request(app).get('/api/v1/hosts/host-1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(true);
    });

    it('should handle health check failure', async () => {
      (hostService.checkHostHealth as jest.Mock).mockResolvedValue({
        healthy: false,
        message: 'Host is unreachable',
      });

      const response = await request(app).get('/api/v1/hosts/host-1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(false);
    });
  });

  describe('POST /api/v1/hosts/:host_id/execute', () => {
    it('should execute a whitelisted command', async () => {
      const mockResult = {
        success: true,
        exit_code: 0,
        stdout: 'Command output',
        stderr: '',
        duration_ms: 100,
      };

      (hostService.executeCommand as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/hosts/host-1/execute')
        .send({
          command_type: 'check_status',
          executed_by: 'admin',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should return 400 when command_type is missing', async () => {
      const response = await request(app)
        .post('/api/v1/hosts/host-1/execute')
        .send({
          executed_by: 'admin',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle command execution errors', async () => {
      (hostService.executeCommand as jest.Mock).mockRejectedValue(
        new Error('Command not whitelisted')
      );

      const response = await request(app)
        .post('/api/v1/hosts/host-1/execute')
        .send({
          command_type: 'invalid_command',
          executed_by: 'admin',
        });

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
          command: 'check_status',
          executed_by: 'admin',
          executed_at: '2025-10-02T10:00:00Z',
          exit_code: 0,
          output: 'OK',
          error: null,
          duration_ms: 100,
          success: true,
          metadata: null,
        },
      ];

      (hostService.getAuditLogs as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app).get('/api/v1/hosts/host-1/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLogs);
    });
  });

  describe('GET /api/v1/hosts/:host_id/available-commands', () => {
    it('should return available commands for a host', async () => {
      const mockCommands = ['check_status', 'restart_swarm', 'stop_swarm'];
      const mockHost = {
        host_id: 'host-1',
        os_type: 'linux',
      };

      (hostService.getAvailableCommands as jest.Mock).mockResolvedValue(mockCommands);
      (hostService.getHostById as jest.Mock).mockResolvedValue(mockHost);

      const response = await request(app).get('/api/v1/hosts/host-1/available-commands');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available_commands).toEqual(mockCommands);
    });

    it('should handle error when host not found', async () => {
      (hostService.getAvailableCommands as jest.Mock).mockRejectedValue(
        new Error('Host not found: non-existent')
      );

      const response = await request(app).get('/api/v1/hosts/non-existent/available-commands');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
