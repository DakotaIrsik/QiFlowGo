import { Pool, QueryResult } from 'pg';
import { SwarmModel } from './SwarmModel';
import { SwarmStatus, CreateSwarmParams, UpdateSwarmStatusParams } from '../types/swarm';

// Mock the database module
jest.mock('../database/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import dbPool from '../database/db';
const mockQuery = (dbPool as any).query;

describe('SwarmModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return all swarms ordered by last_seen DESC', async () => {
      const mockSwarms: any[] = [
        {
          swarm_id: 'swarm-1',
          name: 'Production Swarm',
          host_url: 'http://prod.local:8001',
          status: 'online',
          last_seen: new Date('2025-10-02T10:00:00Z'),
          health_status: { cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
          active_agents: 5,
          project_completion: 75.5,
          created_at: new Date('2025-10-01T00:00:00Z'),
          updated_at: new Date('2025-10-02T10:00:00Z'),
        },
        {
          swarm_id: 'swarm-2',
          name: 'Dev Swarm',
          host_url: 'http://dev.local:8002',
          status: 'degraded',
          last_seen: new Date('2025-10-02T09:30:00Z'),
          health_status: { cpu_percent: 92, memory_percent: 85, disk_percent: 40 },
          active_agents: 3,
          project_completion: 50.0,
          created_at: new Date('2025-10-01T00:00:00Z'),
          updated_at: new Date('2025-10-02T09:30:00Z'),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockSwarms } as any);

      const result = await SwarmModel.findAll();

      expect(result).toEqual(mockSwarms);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_seen DESC')
      );
    });

    it('should return empty array when no swarms exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await SwarmModel.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(SwarmModel.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById()', () => {
    it('should return swarm when found', async () => {
      const mockSwarm: any = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        host_url: 'http://test.local:8001',
        status: 'online',
        last_seen: new Date(),
        health_status: { cpu_percent: 50, memory_percent: 60, disk_percent: 40 },
        active_agents: 4,
        project_completion: 80.0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockSwarm] } as any);

      const result = await SwarmModel.findById('swarm-1');

      expect(result).toEqual(mockSwarm);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE swarm_id = $1'),
        ['swarm-1']
      );
    });

    it('should return null when swarm not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await SwarmModel.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle special characters in swarm_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      await SwarmModel.findById('swarm-with-special-chars_123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['swarm-with-special-chars_123']
      );
    });
  });

  describe('create()', () => {
    it('should create new swarm with default offline status', async () => {
      const params: CreateSwarmParams = {
        swarm_id: 'new-swarm',
        name: 'New Swarm',
        host_url: 'http://new.local:8003',
      };

      const mockCreatedSwarm: any = {
        ...params,
        status: 'offline',
        last_seen: new Date(),
        health_status: null,
        active_agents: null,
        project_completion: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockCreatedSwarm] } as any);

      const result = await SwarmModel.create(params);

      expect(result).toEqual(mockCreatedSwarm);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("VALUES ($1, $2, $3, 'offline', NOW())"),
        ['new-swarm', 'New Swarm', 'http://new.local:8003']
      );
    });

    it('should handle database constraint violations', async () => {
      const params: CreateSwarmParams = {
        swarm_id: 'duplicate-swarm',
        name: 'Duplicate',
        host_url: 'http://dup.local:8004',
      };

      const constraintError = new Error('duplicate key value violates unique constraint');
      mockQuery.mockRejectedValue(constraintError);

      await expect(SwarmModel.create(params)).rejects.toThrow(
        'duplicate key value violates unique constraint'
      );
    });
  });

  describe('updateStatus()', () => {
    it('should update swarm status only', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        status: 'degraded',
      };

      const mockUpdated: any = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        host_url: 'http://test.local:8001',
        status: 'degraded',
        last_seen: new Date(),
        health_status: null,
        active_agents: null,
        project_completion: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await SwarmModel.updateStatus(params);

      expect(result).toEqual(mockUpdated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('last_seen = NOW()'),
        expect.arrayContaining(['degraded', 'swarm-1'])
      );
    });

    it('should update all status fields', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        status: 'online',
        health_status: {
          cpu_percent: 55.5,
          memory_percent: 70.2,
          disk_percent: 35.0,
        },
        active_agents: 6,
        project_completion: 85.5,
      };

      const mockUpdated: any = {
        swarm_id: 'swarm-1',
        name: 'Test Swarm',
        host_url: 'http://test.local:8001',
        status: 'online',
        last_seen: new Date(),
        health_status: params.health_status,
        active_agents: 6,
        project_completion: 85.5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await SwarmModel.updateStatus(params);

      expect(result).toEqual(mockUpdated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('health_status'),
        expect.arrayContaining([
          'online',
          JSON.stringify(params.health_status),
          6,
          85.5,
          'swarm-1',
        ])
      );
    });

    it('should handle zero values for active_agents and project_completion', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        active_agents: 0,
        project_completion: 0,
      };

      mockQuery.mockResolvedValue({ rows: [{}] } as any);

      await SwarmModel.updateStatus(params);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('active_agents'),
        expect.arrayContaining([0, 0, 'swarm-1'])
      );
    });

    it('should return null when swarm not found', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'non-existent',
        status: 'online',
      };

      mockQuery.mockResolvedValue({ rows: [] } as any);

      const result = await SwarmModel.updateStatus(params);

      expect(result).toBeNull();
    });

    it('should always update last_seen timestamp', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
      };

      mockQuery.mockResolvedValue({ rows: [{}] } as any);

      await SwarmModel.updateStatus(params);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('last_seen = NOW()'),
        ['swarm-1']
      );
    });
  });

  describe('markStaleAsOffline()', () => {
    it('should mark stale swarms as offline with default 60 seconds', async () => {
      mockQuery.mockResolvedValue({ rowCount: 3, rows: [{}, {}, {}] } as any);

      const count = await SwarmModel.markStaleAsOffline();

      expect(count).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("last_seen < NOW() - INTERVAL '60 seconds'")
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status != 'offline'")
      );
    });

    it('should use custom staleSeconds parameter', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [{}] } as any);

      const count = await SwarmModel.markStaleAsOffline(120);

      expect(count).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("last_seen < NOW() - INTERVAL '120 seconds'")
      );
    });

    it('should return 0 when no stale swarms found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] } as any);

      const count = await SwarmModel.markStaleAsOffline(60);

      expect(count).toBe(0);
    });

    it('should not update swarms already marked offline', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] } as any);

      await SwarmModel.markStaleAsOffline(60);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status != 'offline'")
      );
    });

    it('should handle null rowCount', async () => {
      mockQuery.mockResolvedValue({ rowCount: null, rows: [] } as unknown as any);

      const count = await SwarmModel.markStaleAsOffline(60);

      expect(count).toBe(0);
    });
  });

  describe('delete()', () => {
    it('should delete swarm and return true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 } as any);

      const result = await SwarmModel.delete('swarm-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM swarms WHERE swarm_id = $1',
        ['swarm-1']
      );
    });

    it('should return false when swarm not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 } as any);

      const result = await SwarmModel.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should handle null rowCount', async () => {
      mockQuery.mockResolvedValue({ rowCount: null } as unknown as any);

      const result = await SwarmModel.delete('swarm-1');

      expect(result).toBe(false);
    });

    it('should propagate foreign key constraint errors', async () => {
      const constraintError = new Error('foreign key constraint violation');
      mockQuery.mockRejectedValue(constraintError);

      await expect(SwarmModel.delete('swarm-1')).rejects.toThrow(
        'foreign key constraint violation'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long swarm names', async () => {
      const longName = 'A'.repeat(1000);
      const params: CreateSwarmParams = {
        swarm_id: 'swarm-long',
        name: longName,
        host_url: 'http://long.local:8005',
      };

      mockQuery.mockResolvedValue({ rows: [{ name: longName }] } as any);

      await SwarmModel.create(params);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([longName])
      );
    });

    it('should handle empty health_status object', async () => {
      const params: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        health_status: {} as any,
      };

      mockQuery.mockResolvedValue({ rows: [{}] } as any);

      await SwarmModel.updateStatus(params);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({}), 'swarm-1'])
      );
    });

    it('should handle concurrent updates gracefully', async () => {
      const params1: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        status: 'online',
      };

      const params2: UpdateSwarmStatusParams = {
        swarm_id: 'swarm-1',
        status: 'degraded',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ status: 'online' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'degraded' }] } as any);

      const [result1, result2] = await Promise.all([
        SwarmModel.updateStatus(params1),
        SwarmModel.updateStatus(params2),
      ]);

      expect(result1?.status).toBe('online');
      expect(result2?.status).toBe('degraded');
    });
  });

  describe('SQL Injection Protection', () => {
    it('should use parameterized queries for findById', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      await SwarmModel.findById("'; DROP TABLE swarms; --");

      // Should pass the malicious string as a parameter, not in the query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ["'; DROP TABLE swarms; --"]
      );
    });

    it('should use parameterized queries for delete', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 } as any);

      await SwarmModel.delete("1' OR '1'='1");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ["1' OR '1'='1"]
      );
    });
  });
});
