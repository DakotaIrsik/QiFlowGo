import { SwarmModel } from '../models/SwarmModel';
import { SwarmControlService, ControlActionResult } from './swarmControlService';
import { cache } from './cacheService';

export interface BatchOperationRequest {
  action: string;
  swarm_ids: string[];
  parameters?: Record<string, any>;
}

export interface BatchOperationResult {
  batch_id: string;
  action: string;
  total_swarms: number;
  successful: number;
  failed: number;
  in_progress: number;
  results: BatchSwarmResult[];
  started_at: string;
  completed_at?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial_failure' | 'failed';
}

export interface BatchSwarmResult {
  swarm_id: string;
  swarm_name: string;
  status: 'pending' | 'success' | 'failed';
  result?: ControlActionResult;
  error?: string;
}

export interface SwarmGroup {
  group_id: string;
  name: string;
  description?: string;
  swarm_ids: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Batch Operations Service
 * Enables batch operations across multiple swarms simultaneously
 * Implements Issue #17 - Multi-Swarm Batch Operations
 */
export class BatchOperationsService {
  private static batchResults = new Map<string, BatchOperationResult>();

  /**
   * Execute a batch operation across multiple swarms
   * Supports all control actions: pause, resume, restart_agent, force_sync, emergency_stop, manual_trigger, apply_schedule_preset
   */
  static async executeBatchOperation(request: BatchOperationRequest): Promise<BatchOperationResult> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { action, swarm_ids, parameters } = request;

    // Validate request
    if (!swarm_ids || !Array.isArray(swarm_ids) || swarm_ids.length === 0) {
      throw new Error('Missing or invalid field: swarm_ids (must be non-empty array)');
    }

    // Validate swarms exist
    const swarms = await Promise.all(
      swarm_ids.map(async (id) => ({
        id,
        exists: await SwarmModel.findById(id),
      }))
    );

    const validSwarms = swarms.filter((s) => s.exists);
    const invalidSwarms = swarms.filter((s) => !s.exists);

    if (validSwarms.length === 0) {
      throw new Error('No valid swarms found in batch request');
    }

    // Initialize batch result
    const batchResult: BatchOperationResult = {
      batch_id: batchId,
      action,
      total_swarms: swarm_ids.length,
      successful: 0,
      failed: invalidSwarms.length,
      in_progress: validSwarms.length,
      results: [],
      started_at: new Date().toISOString(),
      status: 'in_progress',
    };

    // Add invalid swarms to results
    for (const invalid of invalidSwarms) {
      batchResult.results.push({
        swarm_id: invalid.id,
        swarm_name: 'Unknown',
        status: 'failed',
        error: 'Swarm not found',
      });
    }

    // Store initial result
    this.batchResults.set(batchId, batchResult);

    // Execute action on all valid swarms
    const executions = validSwarms.map(async (swarmData) => {
      const swarmId = swarmData.id;
      const swarm = swarmData.exists!;

      try {
        // Validate action for this swarm
        const validation = await SwarmControlService.validateControlAction(swarmId, action);
        if (!validation.valid) {
          return {
            swarm_id: swarmId,
            swarm_name: swarm.name,
            status: 'failed' as const,
            error: validation.error,
          };
        }

        // Execute control action
        let result: ControlActionResult;
        switch (action) {
          case 'pause':
            result = await SwarmControlService.pauseSwarm(swarmId);
            break;

          case 'resume':
            result = await SwarmControlService.resumeSwarm(swarmId);
            break;

          case 'restart_agent':
            result = await SwarmControlService.restartAgent(swarmId, parameters?.agent_id);
            break;

          case 'force_sync':
            result = await SwarmControlService.forceSync(swarmId);
            break;

          case 'emergency_stop':
            result = await SwarmControlService.emergencyStop(swarmId, parameters?.reason);
            break;

          case 'manual_trigger':
            result = await SwarmControlService.manualTrigger(swarmId);
            break;

          case 'apply_schedule_preset':
            if (!parameters?.preset_name) {
              throw new Error('Missing preset_name parameter');
            }
            result = await SwarmControlService.applySchedulePreset(swarmId, parameters.preset_name);
            break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        return {
          swarm_id: swarmId,
          swarm_name: swarm.name,
          status: 'success' as const,
          result,
        };
      } catch (error: any) {
        return {
          swarm_id: swarmId,
          swarm_name: swarm.name,
          status: 'failed' as const,
          error: error.message || 'Unknown error',
        };
      }
    });

    // Wait for all executions to complete
    const results = await Promise.all(executions);
    batchResult.results.push(...results);

    // Update counters
    batchResult.successful = results.filter((r) => r.status === 'success').length;
    batchResult.failed = batchResult.results.filter((r) => r.status === 'failed').length;
    batchResult.in_progress = 0;
    batchResult.completed_at = new Date().toISOString();

    // Determine overall status
    if (batchResult.failed === 0) {
      batchResult.status = 'completed';
    } else if (batchResult.successful > 0) {
      batchResult.status = 'partial_failure';
    } else {
      batchResult.status = 'failed';
    }

    // Update stored result
    this.batchResults.set(batchId, batchResult);

    // Log audit trail
    console.log(`[AUDIT] Batch operation ${batchId} completed`, {
      action,
      total_swarms: batchResult.total_swarms,
      successful: batchResult.successful,
      failed: batchResult.failed,
      timestamp: new Date().toISOString(),
    });

    return batchResult;
  }

  /**
   * Get batch operation result by ID
   */
  static getBatchResult(batchId: string): BatchOperationResult | null {
    return this.batchResults.get(batchId) || null;
  }

  /**
   * Get all batch operation results (last 100)
   */
  static getAllBatchResults(): BatchOperationResult[] {
    const results = Array.from(this.batchResults.values());
    return results
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 100);
  }

  /**
   * Create a swarm group
   */
  static async createGroup(name: string, description?: string, swarmIds?: string[]): Promise<SwarmGroup> {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate swarms exist
    if (swarmIds && swarmIds.length > 0) {
      const swarms = await Promise.all(swarmIds.map((id) => SwarmModel.findById(id)));
      const validSwarms = swarms.filter((s) => s !== null);

      if (validSwarms.length !== swarmIds.length) {
        throw new Error('Some swarms not found');
      }
    }

    const group: SwarmGroup = {
      group_id: groupId,
      name,
      description,
      swarm_ids: swarmIds || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store in cache (in production, this would be in database)
    const cacheKey = `group:${groupId}`;
    cache.set(cacheKey, group, 0); // No expiry for groups

    // Also store in group list
    const groupList: SwarmGroup[] = (cache.get('groups:all') as SwarmGroup[]) || [];
    groupList.push(group);
    cache.set('groups:all', groupList, 0);

    console.log(`[AUDIT] Created swarm group ${groupId}`, {
      name,
      swarm_count: group.swarm_ids.length,
      timestamp: new Date().toISOString(),
    });

    return group;
  }

  /**
   * Get a swarm group by ID
   */
  static getGroup(groupId: string): SwarmGroup | null {
    const cacheKey = `group:${groupId}`;
    return cache.get(cacheKey);
  }

  /**
   * Get all swarm groups
   */
  static getAllGroups(): SwarmGroup[] {
    return (cache.get('groups:all') as SwarmGroup[]) || [];
  }

  /**
   * Update a swarm group
   */
  static async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; swarm_ids?: string[] }
  ): Promise<SwarmGroup | null> {
    const group = this.getGroup(groupId);
    if (!group) {
      return null;
    }

    // Validate swarms if updating swarm_ids
    if (updates.swarm_ids) {
      const swarms = await Promise.all(updates.swarm_ids.map((id) => SwarmModel.findById(id)));
      const validSwarms = swarms.filter((s) => s !== null);

      if (validSwarms.length !== updates.swarm_ids.length) {
        throw new Error('Some swarms not found');
      }
    }

    // Update fields
    const updatedGroup: SwarmGroup = {
      ...group,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Update cache
    const cacheKey = `group:${groupId}`;
    cache.set(cacheKey, updatedGroup, 0);

    // Update group list
    const groupList = this.getAllGroups();
    const index = groupList.findIndex((g) => g.group_id === groupId);
    if (index >= 0) {
      groupList[index] = updatedGroup;
      cache.set('groups:all', groupList, 0);
    }

    console.log(`[AUDIT] Updated swarm group ${groupId}`, {
      timestamp: new Date().toISOString(),
    });

    return updatedGroup;
  }

  /**
   * Delete a swarm group
   */
  static deleteGroup(groupId: string): boolean {
    const group = this.getGroup(groupId);
    if (!group) {
      return false;
    }

    // Remove from cache
    cache.invalidatePattern(`group:${groupId}`);

    // Remove from group list
    const groupList = this.getAllGroups();
    const filteredList = groupList.filter((g) => g.group_id !== groupId);
    cache.set('groups:all', filteredList, 0);

    console.log(`[AUDIT] Deleted swarm group ${groupId}`, {
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Execute batch operation on a swarm group
   */
  static async executeBatchOperationOnGroup(
    groupId: string,
    action: string,
    parameters?: Record<string, any>
  ): Promise<BatchOperationResult> {
    const group = this.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.swarm_ids.length === 0) {
      throw new Error('Group has no swarms');
    }

    console.log(`[AUDIT] Executing batch operation on group ${groupId}`, {
      action,
      swarm_count: group.swarm_ids.length,
      timestamp: new Date().toISOString(),
    });

    return this.executeBatchOperation({
      action,
      swarm_ids: group.swarm_ids,
      parameters,
    });
  }
}
