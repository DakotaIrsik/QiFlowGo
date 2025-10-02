import { Router, Request, Response } from 'express';
import { InterventionFlagModel } from '../models/InterventionFlagModel';
import { CreateInterventionFlagParams } from '../types/interventionFlag';

const router = Router();

/**
 * GET /api/v1/swarms/:swarm_id/interventions
 * List all flagged issues for a swarm
 */
router.get('/swarms/:swarm_id/interventions', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const { priority, resolved, limit, offset } = req.query;

    const flags = await InterventionFlagModel.find({
      swarm_id,
      priority: priority as any,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: flags,
      count: flags.length,
    });
  } catch (error) {
    console.error('Error fetching intervention flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch intervention flags',
    });
  }
});

/**
 * GET /api/v1/swarms/:swarm_id/interventions/count
 * Count of unresolved flags by priority
 */
router.get('/swarms/:swarm_id/interventions/count', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const count = await InterventionFlagModel.getCount(swarm_id);

    res.json({
      success: true,
      data: count,
    });
  } catch (error) {
    console.error('Error counting intervention flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to count intervention flags',
    });
  }
});

/**
 * POST /api/v1/swarms/:swarm_id/issues/:issue_id/flag
 * Manually flag an issue for human intervention
 */
router.post('/swarms/:swarm_id/issues/:issue_id/flag', async (req: Request, res: Response) => {
  try {
    const { swarm_id, issue_id } = req.params;
    const { priority, reason, note, github_url } = req.body;

    // Validation
    if (!priority || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: priority, reason',
      });
    }

    if (!['critical', 'review'].includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority. Must be "critical" or "review"',
      });
    }

    const params: CreateInterventionFlagParams = {
      swarm_id,
      issue_number: parseInt(issue_id),
      github_url,
      priority,
      reason,
      trigger_type: 'manual',
      metadata: note ? { note } : undefined,
    };

    const flag = await InterventionFlagModel.create(params);

    res.status(201).json({
      success: true,
      data: flag,
    });
  } catch (error) {
    console.error('Error creating intervention flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create intervention flag',
    });
  }
});

/**
 * PUT /api/v1/swarms/:swarm_id/interventions/:flag_id/resolve
 * Mark an intervention flag as resolved
 */
router.put('/swarms/:swarm_id/interventions/:flag_id/resolve', async (req: Request, res: Response) => {
  try {
    const { flag_id } = req.params;
    const { resolution_note, resolved_by } = req.body;

    if (!resolved_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: resolved_by',
      });
    }

    const flag = await InterventionFlagModel.resolve({
      flag_id: parseInt(flag_id),
      resolved_by,
      resolution_note,
    });

    if (!flag) {
      return res.status(404).json({
        success: false,
        error: 'Flag not found or already resolved',
      });
    }

    res.json({
      success: true,
      data: flag,
    });
  } catch (error) {
    console.error('Error resolving intervention flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve intervention flag',
    });
  }
});

/**
 * DELETE /api/v1/swarms/:swarm_id/issues/:issue_id/flag/:flag_id
 * Unflag/delete an intervention flag
 */
router.delete('/swarms/:swarm_id/issues/:issue_id/flag/:flag_id', async (req: Request, res: Response) => {
  try {
    const { flag_id } = req.params;

    const deleted = await InterventionFlagModel.delete(parseInt(flag_id));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Flag not found',
      });
    }

    res.json({
      success: true,
      message: 'Flag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting intervention flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete intervention flag',
    });
  }
});

/**
 * POST /api/v1/swarms/:swarm_id/interventions/bulk-resolve
 * Resolve multiple intervention flags at once
 */
router.post('/swarms/:swarm_id/interventions/bulk-resolve', async (req: Request, res: Response) => {
  try {
    const { flag_ids, resolution_note, resolved_by } = req.body;

    if (!flag_ids || !Array.isArray(flag_ids) || flag_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: flag_ids (must be non-empty array)',
      });
    }

    if (!resolved_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: resolved_by',
      });
    }

    const count = await InterventionFlagModel.bulkResolve(
      flag_ids.map((id: any) => parseInt(id)),
      resolved_by,
      resolution_note
    );

    res.json({
      success: true,
      data: {
        resolved_count: count,
      },
    });
  } catch (error) {
    console.error('Error bulk resolving intervention flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk resolve intervention flags',
    });
  }
});

export default router;
