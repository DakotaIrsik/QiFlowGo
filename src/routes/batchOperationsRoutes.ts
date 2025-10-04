import { Router, Request, Response } from 'express';
import { BatchOperationsService } from '../services/batchOperationsService';

const router = Router();

/**
 * POST /api/v1/batch/execute
 * Execute a batch operation across multiple swarms
 * Request body: { action, swarm_ids, parameters }
 * Used by mobile app Multi-Swarm Batch Operations (Issue #17)
 */
router.post('/batch/execute', async (req: Request, res: Response) => {
  try {
    const { action, swarm_ids, parameters } = req.body;

    // Validation
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: action',
      });
    }

    if (!swarm_ids || !Array.isArray(swarm_ids) || swarm_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: swarm_ids (must be non-empty array)',
      });
    }

    const validActions = [
      'pause',
      'resume',
      'restart_agent',
      'force_sync',
      'emergency_stop',
      'manual_trigger',
      'apply_schedule_preset',
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    // Execute batch operation
    const result = await BatchOperationsService.executeBatchOperation({
      action,
      swarm_ids,
      parameters,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error executing batch operation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute batch operation',
    });
  }
});

/**
 * GET /api/v1/batch/:batch_id
 * Get batch operation result by ID
 * Used to check progress and results of a batch operation
 */
router.get('/batch/:batch_id', (req: Request, res: Response) => {
  try {
    const { batch_id } = req.params;

    const result = BatchOperationsService.getBatchResult(batch_id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Batch operation not found',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching batch result:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch batch result',
    });
  }
});

/**
 * GET /api/v1/batch
 * Get all batch operation results (last 100)
 * Used by mobile app to show batch operation history
 */
router.get('/batch', (req: Request, res: Response) => {
  try {
    const results = BatchOperationsService.getAllBatchResults();

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error fetching batch results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch batch results',
    });
  }
});

/**
 * POST /api/v1/groups
 * Create a swarm group
 * Request body: { name, description?, swarm_ids? }
 * Used by mobile app to organize swarms into groups
 */
router.post('/groups', async (req: Request, res: Response) => {
  try {
    const { name, description, swarm_ids } = req.body;

    // Validation
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: name (must be string)',
      });
    }

    if (swarm_ids && !Array.isArray(swarm_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field: swarm_ids (must be array)',
      });
    }

    const group = await BatchOperationsService.createGroup(name, description, swarm_ids);

    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create group',
    });
  }
});

/**
 * GET /api/v1/groups
 * Get all swarm groups
 * Used by mobile app group selection UI
 */
router.get('/groups', (req: Request, res: Response) => {
  try {
    const groups = BatchOperationsService.getAllGroups();

    res.json({
      success: true,
      data: groups,
    });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch groups',
    });
  }
});

/**
 * GET /api/v1/groups/:group_id
 * Get a swarm group by ID
 */
router.get('/groups/:group_id', (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;

    const group = BatchOperationsService.getGroup(group_id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    console.error('Error fetching group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch group',
    });
  }
});

/**
 * PUT /api/v1/groups/:group_id
 * Update a swarm group
 * Request body: { name?, description?, swarm_ids? }
 */
router.put('/groups/:group_id', async (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;
    const { name, description, swarm_ids } = req.body;

    // Validation
    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid field: name (must be string)',
      });
    }

    if (swarm_ids !== undefined && !Array.isArray(swarm_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field: swarm_ids (must be array)',
      });
    }

    const group = await BatchOperationsService.updateGroup(group_id, {
      name,
      description,
      swarm_ids,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    console.error('Error updating group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update group',
    });
  }
});

/**
 * DELETE /api/v1/groups/:group_id
 * Delete a swarm group
 */
router.delete('/groups/:group_id', (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;

    const deleted = BatchOperationsService.deleteGroup(group_id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    res.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete group',
    });
  }
});

/**
 * POST /api/v1/groups/:group_id/execute
 * Execute batch operation on a swarm group
 * Request body: { action, parameters? }
 * Convenience endpoint for executing actions on all swarms in a group
 */
router.post('/groups/:group_id/execute', async (req: Request, res: Response) => {
  try {
    const { group_id } = req.params;
    const { action, parameters } = req.body;

    // Validation
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: action',
      });
    }

    const validActions = [
      'pause',
      'resume',
      'restart_agent',
      'force_sync',
      'emergency_stop',
      'manual_trigger',
      'apply_schedule_preset',
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    const result = await BatchOperationsService.executeBatchOperationOnGroup(
      group_id,
      action,
      parameters
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error executing group batch operation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute group batch operation',
    });
  }
});

export default router;
