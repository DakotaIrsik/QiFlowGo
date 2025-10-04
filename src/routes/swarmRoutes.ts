import { Router, Request, Response } from 'express';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';
import { CreateSwarmParams } from '../types/swarm';

const router = Router();

/**
 * GET /api/v1/swarms
 * List all swarms with basic status (30s cache TTL)
 * Used by mobile app dashboard with 30s polling
 * Query params: customer, status, host_type, priority, search
 */
router.get('/swarms', async (req: Request, res: Response) => {
  try {
    const { customer, status, host_type, priority, search } = req.query;
    const cacheKey = `swarms:all:${JSON.stringify(req.query)}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch from database with filters
    let swarms = await SwarmModel.findAll();

    // Apply filters
    if (status && typeof status === 'string') {
      swarms = swarms.filter((s) => s.status === status);
    }

    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      swarms = swarms.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.swarm_id.toLowerCase().includes(searchLower)
      );
    }

    // Cache for 30 seconds
    cache.set(cacheKey, swarms, 30000);

    res.json({
      success: true,
      data: swarms,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching swarms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swarms',
    });
  }
});

/**
 * GET /api/v1/swarms/stats/aggregate
 * Get aggregate statistics across all swarms
 * Used by mobile app dashboard
 */
router.get('/swarms/stats/aggregate', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'swarms:stats:aggregate';

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch all swarms
    const swarms = await SwarmModel.findAll();

    // Calculate aggregate stats
    const stats = {
      total_swarms: swarms.length,
      swarms_running: swarms.filter((s) => s.status === 'online').length,
      swarms_offline: swarms.filter((s) => s.status === 'offline').length,
      swarms_degraded: swarms.filter((s) => s.status === 'degraded').length,
      total_active_agents: swarms.reduce((sum, s) => sum + (s.active_agents || 0), 0),
      avg_project_completion: swarms.length > 0
        ? swarms.reduce((sum, s) => sum + (s.project_completion || 0), 0) / swarms.length
        : 0,
      alerts_count: swarms.filter(
        (s) =>
          s.health_status?.cpu_percent > 90 ||
          s.health_status?.memory_percent > 90 ||
          s.health_status?.disk_percent > 90
      ).length,
    };

    // Cache for 30 seconds
    cache.set(cacheKey, stats, 30000);

    res.json({
      success: true,
      data: stats,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching aggregate stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch aggregate stats',
    });
  }
});

/**
 * GET /api/v1/swarms/:swarm_id
 * Get detailed swarm status (15s cache TTL)
 * Used by mobile app detail view with 15s polling
 */
router.get('/swarms/:swarm_id', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const cacheKey = `swarm:${swarm_id}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch from database
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Cache for 15 seconds
    cache.set(cacheKey, swarm, 15000);

    res.json({
      success: true,
      data: swarm,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching swarm:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swarm',
    });
  }
});

/**
 * GET /api/v1/swarms/:swarm_id/status
 * Lightweight status check (15s cache TTL)
 * Returns only essential status info for quick updates
 */
router.get('/swarms/:swarm_id/status', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const cacheKey = `swarm:${swarm_id}:status`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch from database
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Return only lightweight status
    const status = {
      swarm_id: swarm.swarm_id,
      status: swarm.status,
      last_seen: swarm.last_seen,
      health_status: swarm.health_status,
      active_agents: swarm.active_agents,
    };

    // Cache for 15 seconds
    cache.set(cacheKey, status, 15000);

    res.json({
      success: true,
      data: status,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching swarm status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swarm status',
    });
  }
});

/**
 * POST /api/v1/swarms
 * Register a new swarm
 */
router.post('/swarms', async (req: Request, res: Response) => {
  try {
    const { swarm_id, name, host_url } = req.body;

    // Validation
    if (!swarm_id || !name || !host_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: swarm_id, name, host_url',
      });
    }

    // Validate URL format
    try {
      new URL(host_url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid host_url format',
      });
    }

    const params: CreateSwarmParams = {
      swarm_id,
      name,
      host_url,
    };

    const swarm = await SwarmModel.create(params);

    // Invalidate cache
    cache.invalidatePattern('swarms:');

    res.status(201).json({
      success: true,
      data: swarm,
    });
  } catch (error: any) {
    console.error('Error creating swarm:', error);

    // Handle duplicate key error
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Swarm with this ID already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create swarm',
    });
  }
});

/**
 * DELETE /api/v1/swarms/:swarm_id
 * Unregister a swarm
 */
router.delete('/swarms/:swarm_id', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;

    const deleted = await SwarmModel.delete(swarm_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Invalidate cache
    cache.invalidatePattern('swarms:');
    cache.invalidatePattern(`swarm:${swarm_id}`);

    res.json({
      success: true,
      message: 'Swarm deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting swarm:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete swarm',
    });
  }
});

/**
 * POST /api/v1/heartbeat
 * Receive heartbeat data from swarm deployments
 * Updates swarm status and health metrics
 */
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const { swarm_id, status, health_status, active_agents, project_completion } = req.body;

    // Validation
    if (!swarm_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: swarm_id',
      });
    }

    // Check if swarm exists
    const existingSwarm = await SwarmModel.findById(swarm_id);
    if (!existingSwarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found. Please register the swarm first.',
      });
    }

    // Validate health_status if provided
    if (health_status) {
      const { cpu_percent, memory_percent, disk_percent } = health_status;
      if (
        typeof cpu_percent !== 'number' ||
        typeof memory_percent !== 'number' ||
        typeof disk_percent !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid health_status format. Expected numbers for cpu_percent, memory_percent, disk_percent',
        });
      }
    }

    // Update swarm status
    const updatedSwarm = await SwarmModel.updateStatus({
      swarm_id,
      status: status || 'online',
      health_status,
      active_agents,
      project_completion,
    });

    // Invalidate cache
    cache.invalidatePattern('swarms:');
    cache.invalidatePattern(`swarm:${swarm_id}`);

    res.json({
      success: true,
      data: updatedSwarm,
      message: 'Heartbeat received',
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat',
    });
  }
});

/**
 * POST /api/v1/swarms/:swarm_id/control
 * Execute control actions on a swarm
 * Actions: start, stop, restart, update
 */
router.post('/swarms/:swarm_id/control', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const { action, parameters } = req.body;

    // Validation
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: action',
      });
    }

    const validActions = ['start', 'stop', 'restart', 'update', 'config'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    // Check if swarm exists
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Log control action for audit
    console.log(`[AUDIT] Control action on swarm ${swarm_id}: ${action}`, {
      parameters,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, this would trigger remote commands
    // For now, we return a success response
    res.json({
      success: true,
      message: `Control action '${action}' queued for swarm ${swarm_id}`,
      data: {
        swarm_id,
        action,
        parameters,
        status: 'queued',
        queued_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error executing control action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute control action',
    });
  }
});

/**
 * POST /api/v1/swarms/refresh
 * Manually trigger cache invalidation and force refresh
 * Used by pull-to-refresh in mobile app
 */
router.post('/swarms/refresh', (req: Request, res: Response) => {
  try {
    cache.invalidatePattern('swarms:');
    cache.invalidatePattern('swarm:');

    res.json({
      success: true,
      message: 'Cache invalidated, next request will fetch fresh data',
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache',
    });
  }
});

export default router;
