import { HostModel } from './HostModel';
import { Host, CreateHostParams, UpdateHostParams } from '../types/host';

// Mock the database module
jest.mock('../database/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import dbPool from '../database/db';
const mockQuery = (dbPool as any).query;

describe('HostModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return all hosts ordered by created_at DESC', async () => {
      const mockHosts: any[] = [
        {
          host_id: 'host-1',
          name: 'Production Server',
          hostname: 'prod.example.com',
          port: 22,
          username: 'deploy',
          os_type: 'linux',
          status: 'online',
          last_seen: new Date('2025-10-02T10:00:00Z'),
          ssh_key_path: '/home/user/.ssh/id_rsa',
          capacity_max_swarms: 5,
          current_swarms: 2,
          metadata: { location: 'us-east-1' },
          created_at: new Date('2025-10-01T00:00:00Z'),
          updated_at: new Date('2025-10-02T10:00:00Z'),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockHosts } as any);

      const result = await HostModel.findAll();

      expect(result).toEqual(mockHosts);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById()', () => {
    it('should return a host when found', async () => {
      const mockHost: any = {
        host_id: 'host-1',
        name: 'Production Server',
        hostname: 'prod.example.com',
        port: 22,
        username: 'deploy',
        os_type: 'linux',
        status: 'online',
        last_seen: new Date('2025-10-02T10:00:00Z'),
        ssh_key_path: '/home/user/.ssh/id_rsa',
        capacity_max_swarms: 5,
        current_swarms: 2,
        metadata: null,
        created_at: new Date('2025-10-01T00:00:00Z'),
        updated_at: new Date('2025-10-02T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockHost] } as any);

      const result = await HostModel.findById('host-1');

      expect(result).toEqual(mockHost);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['host-1']);
    });

    it('should return null when host not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await HostModel.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create a new host with all parameters', async () => {
      const params: CreateHostParams = {
        host_id: 'host-1',
        name: 'Production Server',
        hostname: 'prod.example.com',
        port: 22,
        username: 'deploy',
        os_type: 'linux',
        ssh_key_path: '/home/user/.ssh/id_rsa',
        capacity_max_swarms: 10,
        metadata: { location: 'us-east-1' },
      };

      const mockHost: any = {
        ...params,
        status: 'offline',
        last_seen: null,
        current_swarms: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockHost] } as any);

      const result = await HostModel.create(params);

      expect(result).toEqual(mockHost);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'host-1',
          'Production Server',
          'prod.example.com',
          22,
          'deploy',
          'linux',
          '/home/user/.ssh/id_rsa',
          10,
          JSON.stringify({ location: 'us-east-1' }),
        ])
      );
    });

    it('should create a new host with default values', async () => {
      const params: CreateHostParams = {
        host_id: 'host-2',
        name: 'Dev Server',
        hostname: 'dev.example.com',
        username: 'ubuntu',
        os_type: 'linux',
      };

      const mockHost: any = {
        ...params,
        port: 22,
        status: 'offline',
        last_seen: null,
        ssh_key_path: null,
        capacity_max_swarms: 5,
        current_swarms: 0,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockHost] } as any);

      const result = await HostModel.create(params);

      expect(result).toEqual(mockHost);
    });
  });

  describe('update()', () => {
    it('should update host status', async () => {
      const params: UpdateHostParams = {
        host_id: 'host-1',
        status: 'online',
      };

      const mockHost: any = {
        host_id: 'host-1',
        name: 'Production Server',
        hostname: 'prod.example.com',
        port: 22,
        username: 'deploy',
        os_type: 'linux',
        status: 'online',
        last_seen: new Date(),
        ssh_key_path: null,
        capacity_max_swarms: 5,
        current_swarms: 2,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockHost] } as any);

      const result = await HostModel.update(params);

      expect(result).toEqual(mockHost);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hosts'),
        expect.arrayContaining(['online', 'host-1'])
      );
    });

    it('should return null when host not found', async () => {
      const params: UpdateHostParams = {
        host_id: 'non-existent',
        status: 'online',
      };

      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await HostModel.update(params);

      expect(result).toBeNull();
    });
  });

  describe('updateLastSeen()', () => {
    it('should update last seen timestamp and status', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 } as any);

      await HostModel.updateLastSeen('host-1', 'online');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hosts'),
        ['host-1', 'online']
      );
    });
  });

  describe('delete()', () => {
    it('should delete a host and return true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 } as any);

      const result = await HostModel.delete('host-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM hosts WHERE host_id = $1',
        ['host-1']
      );
    });

    it('should return false when host not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 } as any);

      const result = await HostModel.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('findAvailable()', () => {
    it('should return hosts with available capacity', async () => {
      const mockHosts: any[] = [
        {
          host_id: 'host-1',
          name: 'Server 1',
          hostname: 'server1.example.com',
          port: 22,
          username: 'deploy',
          os_type: 'linux',
          status: 'online',
          last_seen: new Date(),
          ssh_key_path: null,
          capacity_max_swarms: 10,
          current_swarms: 3,
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockHosts } as any);

      const result = await HostModel.findAvailable();

      expect(result).toEqual(mockHosts);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'online'")
      );
    });
  });

  describe('createAuditLog()', () => {
    it('should create an audit log entry', async () => {
      const params = {
        host_id: 'host-1',
        command: 'restart_swarm',
        executed_by: 'admin@example.com',
        exit_code: 0,
        output: 'Swarm restarted successfully',
        duration_ms: 1500,
        success: true,
        metadata: { request_id: 'req-123' },
      };

      const mockLog: any = {
        id: 1,
        ...params,
        error: null,
        executed_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockLog] } as any);

      const result = await HostModel.createAuditLog(params);

      expect(result).toEqual(mockLog);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'host-1',
          'restart_swarm',
          'admin@example.com',
          0,
          'Swarm restarted successfully',
          null,
          1500,
          true,
          JSON.stringify({ request_id: 'req-123' }),
        ])
      );
    });
  });

  describe('getAuditLogs()', () => {
    it('should return audit logs for a host', async () => {
      const mockLogs: any[] = [
        {
          id: 1,
          host_id: 'host-1',
          command: 'restart_swarm',
          executed_by: 'admin@example.com',
          executed_at: new Date(),
          exit_code: 0,
          output: 'Success',
          error: null,
          duration_ms: 1500,
          success: true,
          metadata: null,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockLogs } as any);

      const result = await HostModel.getAuditLogs('host-1', 50);

      expect(result).toEqual(mockLogs);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['host-1', 50]);
    });
  });
});
