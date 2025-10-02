import { Router, Request, Response } from 'express';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';
import { CreateSwarmParams } from '../types/swarm';

const router = Router();

/**
 * GET /api/v1/swarms
 * List all swarms with basic status (30s cache TTL)
 * Used by mobile app dashboard with 30s polling
 */
router.get('/swarms', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'swarms:all';

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
    const swarms = await SwarmModel.findAll();

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
