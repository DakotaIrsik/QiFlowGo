import { SwarmModel } from '../models/SwarmModel';
import { cache } from './cacheService';

export interface ControlActionResult {
  swarm_id: string;
  action: string;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  message: string;
  queued_at: string;
  executed_at?: string;
  completed_at?: string;
  error?: string;
}

export interface SchedulePreset {
  name: string;
  cron_expression: string;
  timezone: string;
  description?: string;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    name: 'Always Active',
    cron_expression: '* * * * *',
    timezone: 'UTC',
    description: 'Run continuously without pause',
  },
  {
    name: 'Business Hours (9-5 EST)',
    cron_expression: '0 9-17 * * 1-5',
    timezone: 'America/New_York',
    description: 'Run weekdays 9 AM to 5 PM Eastern Time',
  },
  {
    name: 'Nights Only (8PM-6AM)',
    cron_expression: '0 20-23,0-6 * * *',
    timezone: 'UTC',
    description: 'Run overnight hours only',
  },
  {
    name: 'Weekends Only',
    cron_expression: '0 0 * * 6-0',
    timezone: 'UTC',
    description: 'Run on Saturdays and Sundays only',
  },
  {
    name: 'Off-Peak Hours',
    cron_expression: '0 18-23,0-8 * * *',
    timezone: 'UTC',
    description: 'Run during off-peak hours (6 PM - 8 AM)',
  },
];

/**
 * Swarm Control Service
 * Handles all swarm control operations for mobile app
 */
export class SwarmControlService {
  /**
   * Pause a running swarm
   * Gracefully stops all active agents and saves state
   */
  static async pauseSwarm(swarm_id: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    if (swarm.status === 'offline') {
      throw new Error('Cannot pause an offline swarm');
    }

    // Log audit trail
    console.log(`[AUDIT] Pause swarm ${swarm_id}`, {
      timestamp: new Date().toISOString(),
      previous_status: swarm.status,
    });

    // In production, this would send a command to the swarm host
    // For now, we simulate by queuing the action
    const result: ControlActionResult = {
      swarm_id,
      action: 'pause',
      status: 'queued',
      message: 'Pause command queued. Swarm will gracefully stop all agents.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}`);

    return result;
  }

  /**
   * Resume a paused swarm
   * Restarts all agents and resumes from saved state
   */
  static async resumeSwarm(swarm_id: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Log audit trail
    console.log(`[AUDIT] Resume swarm ${swarm_id}`, {
      timestamp: new Date().toISOString(),
      previous_status: swarm.status,
    });

    const result: ControlActionResult = {
      swarm_id,
      action: 'resume',
      status: 'queued',
      message: 'Resume command queued. Swarm will restart all agents.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}`);

    return result;
  }

  /**
   * Restart a specific agent in the swarm
   * Gracefully stops and restarts the agent process
   */
  static async restartAgent(swarm_id: string, agent_id?: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    if (swarm.status === 'offline') {
      throw new Error('Cannot restart agents on an offline swarm');
    }

    // Log audit trail
    console.log(`[AUDIT] Restart agent on swarm ${swarm_id}`, {
      agent_id: agent_id || 'all',
      timestamp: new Date().toISOString(),
    });

    const result: ControlActionResult = {
      swarm_id,
      action: 'restart_agent',
      status: 'queued',
      message: agent_id
        ? `Restart command queued for agent ${agent_id}.`
        : 'Restart command queued for all agents.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}:agents`);

    return result;
  }

  /**
   * Force sync with GitHub
   * Manually triggers repository sync and issue refresh
   */
  static async forceSync(swarm_id: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    if (swarm.status === 'offline') {
      throw new Error('Cannot sync an offline swarm');
    }

    // Log audit trail
    console.log(`[AUDIT] Force sync on swarm ${swarm_id}`, {
      timestamp: new Date().toISOString(),
    });

    const result: ControlActionResult = {
      swarm_id,
      action: 'force_sync',
      status: 'queued',
      message: 'Force sync command queued. Swarm will refresh from GitHub.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate all caches for this swarm
    cache.invalidatePattern(`swarm:${swarm_id}`);

    return result;
  }

  /**
   * Emergency stop
   * Immediately terminates all agents without graceful shutdown
   * Use only in critical situations
   */
  static async emergencyStop(swarm_id: string, reason?: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Log audit trail with high priority
    console.error(`[AUDIT] EMERGENCY STOP on swarm ${swarm_id}`, {
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });

    const result: ControlActionResult = {
      swarm_id,
      action: 'emergency_stop',
      status: 'queued',
      message: 'EMERGENCY STOP command queued. All agents will terminate immediately.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}`);

    return result;
  }

  /**
   * Manual trigger
   * Immediately starts issue processing regardless of schedule
   */
  static async manualTrigger(swarm_id: string): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    if (swarm.status === 'offline') {
      throw new Error('Cannot trigger an offline swarm');
    }

    // Log audit trail
    console.log(`[AUDIT] Manual trigger on swarm ${swarm_id}`, {
      timestamp: new Date().toISOString(),
    });

    const result: ControlActionResult = {
      swarm_id,
      action: 'manual_trigger',
      status: 'queued',
      message: 'Manual trigger command queued. Swarm will start processing immediately.',
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}`);

    return result;
  }

  /**
   * Apply schedule preset
   * Updates swarm schedule with a predefined configuration
   */
  static async applySchedulePreset(
    swarm_id: string,
    presetName: string
  ): Promise<ControlActionResult> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Find preset
    const preset = SCHEDULE_PRESETS.find((p) => p.name === presetName);
    if (!preset) {
      throw new Error(
        `Invalid preset name. Available presets: ${SCHEDULE_PRESETS.map((p) => p.name).join(', ')}`
      );
    }

    // Log audit trail
    console.log(`[AUDIT] Apply schedule preset on swarm ${swarm_id}`, {
      preset: presetName,
      cron_expression: preset.cron_expression,
      timezone: preset.timezone,
      timestamp: new Date().toISOString(),
    });

    // In production, this would update the schedule in the database
    // For now, we simulate by queuing the action
    const result: ControlActionResult = {
      swarm_id,
      action: 'apply_schedule_preset',
      status: 'queued',
      message: `Schedule preset "${preset.name}" applied. New schedule: ${preset.cron_expression} (${preset.timezone})`,
      queued_at: new Date().toISOString(),
    };

    // Invalidate cache
    cache.invalidatePattern(`swarm:${swarm_id}:schedule`);

    return result;
  }

  /**
   * Get available schedule presets
   */
  static getSchedulePresets(): SchedulePreset[] {
    return SCHEDULE_PRESETS;
  }

  /**
   * Validate control action
   * Checks if action is allowed based on current swarm state
   */
  static async validateControlAction(
    swarm_id: string,
    action: string
  ): Promise<{ valid: boolean; error?: string }> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return { valid: false, error: 'Swarm not found' };
    }

    // Check action-specific constraints
    switch (action) {
      case 'pause':
        if (swarm.status === 'offline') {
          return { valid: false, error: 'Cannot pause an offline swarm' };
        }
        break;

      case 'restart_agent':
      case 'force_sync':
      case 'manual_trigger':
        if (swarm.status === 'offline') {
          return { valid: false, error: `Cannot ${action.replace('_', ' ')} an offline swarm` };
        }
        break;

      case 'resume':
        // Resume can be attempted even on offline swarms
        break;

      case 'emergency_stop':
        // Emergency stop always allowed
        break;

      case 'apply_schedule_preset':
        // Always allowed
        break;

      default:
        return { valid: false, error: `Unknown action: ${action}` };
    }

    return { valid: true };
  }
}
