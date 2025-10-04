import { BatchOperationsService } from './batchOperationsService';
import { SwarmModel } from '../models/SwarmModel';
import { SwarmControlService } from './swarmControlService';

jest.mock('../models/SwarmModel');
jest.mock('./swarmControlService');

describe('BatchOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeBatchOperation', () => {
    it('should execute batch operation on multiple swarms', async () => {
      const mockSwarm1 = {
        swarm_id: 'swarm-1',
        name: 'Swarm One',
        status: 'online',
        host_url: 'http://localhost:3001',
      };

      const mockSwarm2 = {
        swarm_id: 'swarm-2',
        name: 'Swarm Two',
        status: 'online',
        host_url: 'http://localhost:3002',
      };

      (SwarmModel.findById as jest.Mock).mockImplementation((id) => {
        if (id === 'swarm-1') return Promise.resolve(mockSwarm1);
        if (id === 'swarm-2') return Promise.resolve(mockSwarm2);
        return Promise.resolve(null);
      });

      (SwarmControlService.validateControlAction as jest.Mock).mockResolvedValue({
        valid: true,
      });

      (SwarmControlService.pauseSwarm as jest.Mock).mockResolvedValue({
        swarm_id: 'test',
        action: 'pause',
        status: 'queued',
        message: 'Pause command queued',
        queued_at: new Date().toISOString(),
      });

      const result = await BatchOperationsService.executeBatchOperation({
        action: 'pause',
        swarm_ids: ['swarm-1', 'swarm-2'],
      });

      expect(result.total_swarms).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(2);
    });

    it('should handle invalid swarms', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        BatchOperationsService.executeBatchOperation({
          action: 'pause',
          swarm_ids: ['invalid-1', 'invalid-2'],
        })
      ).rejects.toThrow('No valid swarms found in batch request');
    });

    it('should handle partial failures', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Swarm One',
        status: 'online',
        host_url: 'http://localhost:3001',
      };

      (SwarmModel.findById as jest.Mock).mockImplementation((id) => {
        if (id === 'swarm-1') return Promise.resolve(mockSwarm);
        return Promise.resolve(null);
      });

      (SwarmControlService.validateControlAction as jest.Mock).mockResolvedValue({
        valid: true,
      });

      (SwarmControlService.pauseSwarm as jest.Mock).mockResolvedValue({
        swarm_id: 'swarm-1',
        action: 'pause',
        status: 'queued',
        message: 'Pause command queued',
        queued_at: new Date().toISOString(),
      });

      const result = await BatchOperationsService.executeBatchOperation({
        action: 'pause',
        swarm_ids: ['swarm-1', 'invalid-1'],
      });

      expect(result.total_swarms).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.status).toBe('partial_failure');
    });

    it('should throw error if no valid swarms', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        BatchOperationsService.executeBatchOperation({
          action: 'pause',
          swarm_ids: [],
        })
      ).rejects.toThrow('Missing or invalid field: swarm_ids');
    });
  });

  describe('createGroup', () => {
    it('should create a swarm group', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        name: 'Swarm One',
        status: 'online',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const group = await BatchOperationsService.createGroup(
        'Test Group',
        'Test description',
        ['swarm-1']
      );

      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('Test description');
      expect(group.swarm_ids).toEqual(['swarm-1']);
      expect(group.group_id).toMatch(/^group_/);
    });

    it('should throw error for invalid swarms', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        BatchOperationsService.createGroup('Test Group', undefined, ['invalid-1'])
      ).rejects.toThrow('Some swarms not found');
    });
  });

  describe('updateGroup', () => {
    it('should update a swarm group', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-2',
        name: 'Swarm Two',
        status: 'online',
      };

      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      // Create a group first
      const group = await BatchOperationsService.createGroup('Test Group', undefined, []);

      // Update the group
      const updated = await BatchOperationsService.updateGroup(group.group_id, {
        name: 'Updated Group',
        swarm_ids: ['swarm-2'],
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Group');
      expect(updated!.swarm_ids).toEqual(['swarm-2']);
    });

    it('should return null for non-existent group', async () => {
      const result = await BatchOperationsService.updateGroup('invalid-group', {
        name: 'Test',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteGroup', () => {
    it('should delete a swarm group', async () => {
      const group = await BatchOperationsService.createGroup('Test Group');

      const deleted = BatchOperationsService.deleteGroup(group.group_id);

      expect(deleted).toBe(true);

      const retrieved = BatchOperationsService.getGroup(group.group_id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent group', () => {
      const deleted = BatchOperationsService.deleteGroup('invalid-group');

      expect(deleted).toBe(false);
    });
  });

  describe('executeBatchOperationOnGroup', () => {
    it('should execute batch operation on group swarms', async () => {
      const mockSwarm1 = {
        swarm_id: 'swarm-1',
        name: 'Swarm One',
        status: 'online',
        host_url: 'http://localhost:3001',
      };

      const mockSwarm2 = {
        swarm_id: 'swarm-2',
        name: 'Swarm Two',
        status: 'online',
        host_url: 'http://localhost:3002',
      };

      (SwarmModel.findById as jest.Mock).mockImplementation((id) => {
        if (id === 'swarm-1') return Promise.resolve(mockSwarm1);
        if (id === 'swarm-2') return Promise.resolve(mockSwarm2);
        return Promise.resolve(null);
      });

      (SwarmControlService.validateControlAction as jest.Mock).mockResolvedValue({
        valid: true,
      });

      (SwarmControlService.pauseSwarm as jest.Mock).mockResolvedValue({
        swarm_id: 'test',
        action: 'pause',
        status: 'queued',
        message: 'Pause command queued',
        queued_at: new Date().toISOString(),
      });

      const group = await BatchOperationsService.createGroup('Test Group', undefined, [
        'swarm-1',
        'swarm-2',
      ]);

      const result = await BatchOperationsService.executeBatchOperationOnGroup(
        group.group_id,
        'pause'
      );

      expect(result.total_swarms).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.status).toBe('completed');
    });

    it('should throw error for non-existent group', async () => {
      await expect(
        BatchOperationsService.executeBatchOperationOnGroup('invalid-group', 'pause')
      ).rejects.toThrow('Group not found');
    });

    it('should throw error for empty group', async () => {
      const group = await BatchOperationsService.createGroup('Empty Group');

      await expect(
        BatchOperationsService.executeBatchOperationOnGroup(group.group_id, 'pause')
      ).rejects.toThrow('Group has no swarms');
    });
  });
});
