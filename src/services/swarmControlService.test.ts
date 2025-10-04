import { SwarmControlService, SCHEDULE_PRESETS } from './swarmControlService';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from './cacheService';

jest.mock('../models/SwarmModel');
jest.mock('./cacheService');

describe('SwarmControlService', () => {
  const mockSwarm = {
    swarm_id: 'test-swarm-1',
    name: 'Test Swarm',
    host_url: 'http://localhost:3000',
    status: 'online' as const,
    last_seen: new Date(),
    health_status: {
      cpu_percent: 50,
      memory_percent: 60,
      disk_percent: 70,
    },
    active_agents: 5,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pauseSwarm', () => {
    it('should pause a running swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.pauseSwarm('test-swarm-1');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('pause');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('Pause command queued');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1');
    });

    it('should throw error if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(SwarmControlService.pauseSwarm('nonexistent')).rejects.toThrow(
        'Swarm not found'
      );
    });

    it('should throw error if swarm is offline', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      await expect(SwarmControlService.pauseSwarm('test-swarm-1')).rejects.toThrow(
        'Cannot pause an offline swarm'
      );
    });
  });

  describe('resumeSwarm', () => {
    it('should resume a paused swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.resumeSwarm('test-swarm-1');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('resume');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('Resume command queued');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1');
    });

    it('should throw error if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(SwarmControlService.resumeSwarm('nonexistent')).rejects.toThrow(
        'Swarm not found'
      );
    });
  });

  describe('restartAgent', () => {
    it('should restart a specific agent', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.restartAgent('test-swarm-1', 'agent-123');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('restart_agent');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('agent agent-123');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1:agents');
    });

    it('should restart all agents if no agent_id provided', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.restartAgent('test-swarm-1');

      expect(result.message).toContain('all agents');
    });

    it('should throw error if swarm is offline', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      await expect(SwarmControlService.restartAgent('test-swarm-1')).rejects.toThrow(
        'Cannot restart agents on an offline swarm'
      );
    });
  });

  describe('forceSync', () => {
    it('should force sync with GitHub', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.forceSync('test-swarm-1');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('force_sync');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('Force sync command queued');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1');
    });

    it('should throw error if swarm is offline', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      await expect(SwarmControlService.forceSync('test-swarm-1')).rejects.toThrow(
        'Cannot sync an offline swarm'
      );
    });
  });

  describe('emergencyStop', () => {
    it('should perform emergency stop', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.emergencyStop('test-swarm-1', 'Critical bug found');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('emergency_stop');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('EMERGENCY STOP');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1');
    });

    it('should work without reason', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.emergencyStop('test-swarm-1');

      expect(result.action).toBe('emergency_stop');
    });
  });

  describe('manualTrigger', () => {
    it('should trigger immediate processing', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.manualTrigger('test-swarm-1');

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('manual_trigger');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('Manual trigger command queued');
    });

    it('should throw error if swarm is offline', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      await expect(SwarmControlService.manualTrigger('test-swarm-1')).rejects.toThrow(
        'Cannot trigger an offline swarm'
      );
    });
  });

  describe('applySchedulePreset', () => {
    it('should apply valid schedule preset', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const result = await SwarmControlService.applySchedulePreset(
        'test-swarm-1',
        'Always Active'
      );

      expect(result.swarm_id).toBe('test-swarm-1');
      expect(result.action).toBe('apply_schedule_preset');
      expect(result.status).toBe('queued');
      expect(result.message).toContain('Always Active');
      expect(cache.invalidatePattern).toHaveBeenCalledWith('swarm:test-swarm-1:schedule');
    });

    it('should throw error for invalid preset name', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      await expect(
        SwarmControlService.applySchedulePreset('test-swarm-1', 'Invalid Preset')
      ).rejects.toThrow('Invalid preset name');
    });

    it('should throw error if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        SwarmControlService.applySchedulePreset('nonexistent', 'Always Active')
      ).rejects.toThrow('Swarm not found');
    });
  });

  describe('getSchedulePresets', () => {
    it('should return all schedule presets', () => {
      const presets = SwarmControlService.getSchedulePresets();

      expect(presets).toHaveLength(SCHEDULE_PRESETS.length);
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('cron_expression');
      expect(presets[0]).toHaveProperty('timezone');
    });

    it('should include expected presets', () => {
      const presets = SwarmControlService.getSchedulePresets();
      const presetNames = presets.map((p) => p.name);

      expect(presetNames).toContain('Always Active');
      expect(presetNames).toContain('Business Hours (9-5 EST)');
      expect(presetNames).toContain('Nights Only (8PM-6AM)');
      expect(presetNames).toContain('Weekends Only');
      expect(presetNames).toContain('Off-Peak Hours');
    });
  });

  describe('validateControlAction', () => {
    it('should validate pause action on online swarm', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const validation = await SwarmControlService.validateControlAction('test-swarm-1', 'pause');

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should reject pause action on offline swarm', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      const validation = await SwarmControlService.validateControlAction('test-swarm-1', 'pause');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Cannot pause an offline swarm');
    });

    it('should allow emergency stop on any swarm', async () => {
      const offlineSwarm = { ...mockSwarm, status: 'offline' as const };
      (SwarmModel.findById as jest.Mock).mockResolvedValue(offlineSwarm);

      const validation = await SwarmControlService.validateControlAction(
        'test-swarm-1',
        'emergency_stop'
      );

      expect(validation.valid).toBe(true);
    });

    it('should reject unknown action', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(mockSwarm);

      const validation = await SwarmControlService.validateControlAction(
        'test-swarm-1',
        'unknown_action'
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Unknown action');
    });

    it('should return error if swarm not found', async () => {
      (SwarmModel.findById as jest.Mock).mockResolvedValue(null);

      const validation = await SwarmControlService.validateControlAction('nonexistent', 'pause');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Swarm not found');
    });
  });
});
