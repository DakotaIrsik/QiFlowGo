import { Router, Request, Response } from 'express';
import { VelocityService } from '../services/velocityService';
import { VelocityMetricsModel } from '../models/VelocityMetricsModel';
import { SwarmModel } from '../models/SwarmModel';
import { cache } from '../services/cacheService';

const router = Router();

/**
 * GET /api/v1/swarms/:swarm_id/velocity
 * Get velocity metrics for a swarm
 *
 * Query params:
 * - days: Rolling window (default: 7, max: 90)
 */
router.get('/swarms/:swarm_id/velocity', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const days = Math.min(parseInt(req.query.days as string) || 7, 90);

    const cacheKey = `velocity:${swarm_id}:${days}`;

    // Check cache first (5 minute TTL for velocity data)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Verify swarm exists
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Calculate velocity
    const velocity = await VelocityService.calculateVelocity(swarm_id, days);
    const trend = VelocityService.detectTrend(velocity.last_n_days);

    const result = {
      ...velocity,
      ...trend,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300000);

    res.json({
      success: true,
      data: result,
      cached: false,
    });
  } catch (error) {
    console.error('Error calculating velocity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate velocity',
    });
  }
});

/**
 * GET /api/v1/swarms/:swarm_id/forecast
 * Get completion forecast for a swarm
 */
router.get('/swarms/:swarm_id/forecast', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;

    const cacheKey = `forecast:${swarm_id}`;

    // Check cache first (5 minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Verify swarm exists and get issue counts
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // For now, use placeholder values for total and completed issues
    // These should be fetched from GitHub API in production
    // Using project_completion if available to estimate completed issues
    const totalIssues = 100; // Placeholder - should come from GitHub API
    const completedIssues = swarm.project_completion
      ? Math.floor((swarm.project_completion / 100) * totalIssues)
      : 0;

    // Generate forecast
    const forecast = await VelocityService.generateForecast(
      swarm_id,
      totalIssues,
      completedIssues
    );

    const result = {
      ...forecast,
      last_updated: new Date().toISOString(),
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300000);

    res.json({
      success: true,
      data: result,
      cached: false,
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate forecast',
    });
  }
});

/**
 * GET /api/v1/swarms/:swarm_id/velocity/history
 * Get historical velocity metrics
 *
 * Query params:
 * - start_date: Start of range (YYYY-MM-DD)
 * - end_date: End of range (YYYY-MM-DD)
 * - granularity: daily, weekly, monthly (default: daily) - NOT IMPLEMENTED YET
 */
router.get('/swarms/:swarm_id/velocity/history', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const { start_date, end_date } = req.query;

    // Validate date parameters
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: start_date, end_date',
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date as string) || !dateRegex.test(end_date as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const cacheKey = `velocity:history:${swarm_id}:${start_date}:${end_date}`;

    // Check cache first (10 minute TTL for historical data)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Verify swarm exists
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Fetch historical metrics
    const metrics = await VelocityMetricsModel.findBySwarmAndDateRange(
      swarm_id,
      start_date as string,
      end_date as string
    );

    const result = {
      metrics: metrics.map(m => ({
        date: m.date,
        issues_closed: m.issues_closed,
        issues_opened: m.issues_opened,
        net_progress: m.net_progress,
        avg_completion_time_hours: m.avg_completion_time_hours,
      })),
    };

    // Cache for 10 minutes
    cache.set(cacheKey, result, 600000);

    res.json({
      success: true,
      data: result,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching velocity history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch velocity history',
    });
  }
});

/**
 * POST /api/v1/swarms/:swarm_id/completions
 * Record an issue completion
 *
 * Body:
 * - issue_number: number
 * - closed_at: ISO timestamp (optional, defaults to now)
 * - time_to_complete_hours: number (optional)
 * - assigned_agent: string (optional)
 */
router.post('/swarms/:swarm_id/completions', async (req: Request, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const { issue_number, closed_at, time_to_complete_hours, assigned_agent } = req.body;

    // Validation
    if (!issue_number) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: issue_number',
      });
    }

    // Verify swarm exists
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      return res.status(404).json({
        success: false,
        error: 'Swarm not found',
      });
    }

    // Record completion
    const closedAtDate = closed_at ? new Date(closed_at) : new Date();
    const completion = await VelocityMetricsModel.recordCompletion(
      swarm_id,
      issue_number,
      closedAtDate,
      time_to_complete_hours || null,
      assigned_agent || null
    );

    // Invalidate velocity caches for this swarm
    cache.invalidatePattern(`velocity:${swarm_id}`);
    cache.invalidatePattern(`forecast:${swarm_id}`);

    res.status(201).json({
      success: true,
      data: completion,
    });
  } catch (error) {
    console.error('Error recording completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record completion',
    });
  }
});

/**
 * POST /api/v1/velocity/aggregate
 * Manually trigger daily aggregation for a specific date
 *
 * Body:
 * - date: YYYY-MM-DD (optional, defaults to yesterday)
 */
router.post('/velocity/aggregate', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    // Default to yesterday if no date provided
    const targetDate = date || (() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    })();

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Run aggregation
    await VelocityService.aggregateDailyMetrics(targetDate);

    // Invalidate all velocity caches
    cache.invalidatePattern('velocity:');
    cache.invalidatePattern('forecast:');

    res.json({
      success: true,
      message: `Daily metrics aggregated for ${targetDate}`,
    });
  } catch (error) {
    console.error('Error aggregating metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to aggregate metrics',
    });
  }
});

export default router;
