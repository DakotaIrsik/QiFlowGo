import { Router, Request, Response } from 'express';
import { githubService } from '../services/githubService';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/v1/swarms/:swarm_id/github/activity
 * Get GitHub activity for a swarm
 */
router.get(
  '/swarms/:swarm_id/github/activity',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { swarm_id } = req.params;
      const { owner, repo, limit } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: owner, repo',
        });
      }

      const activity = await githubService.getActivity(
        swarm_id,
        owner as string,
        repo as string,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: activity,
      });
    } catch (error: any) {
      console.error('Failed to fetch GitHub activity:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch GitHub activity',
      });
    }
  }
);

/**
 * GET /api/v1/swarms/:swarm_id/github/metrics
 * Get GitHub metrics for a swarm
 */
router.get(
  '/swarms/:swarm_id/github/metrics',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { swarm_id } = req.params;
      const { owner, repo } = req.query;

      if (!owner || !repo) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameters: owner, repo',
        });
      }

      const metrics = await githubService.getMetrics(
        swarm_id,
        owner as string,
        repo as string
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      console.error('Failed to fetch GitHub metrics:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch GitHub metrics',
      });
    }
  }
);

/**
 * POST /api/v1/github/webhook
 * Handle GitHub webhook events
 */
router.post('/github/webhook', async (req: Request, res: Response) => {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'Missing X-GitHub-Event header',
      });
    }

    // Process webhook asynchronously
    githubService.processWebhook(eventType, payload).catch((error) => {
      console.error('Webhook processing error:', error);
    });

    // Respond immediately to GitHub
    res.json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error: any) {
    console.error('Failed to handle webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to handle webhook',
    });
  }
});

/**
 * GET /api/v1/github/rate-limit
 * Get current GitHub API rate limit status
 */
router.get('/github/rate-limit', rateLimiter, async (req: Request, res: Response) => {
  try {
    const rateLimit = await githubService.getRateLimit();
    res.json({
      success: true,
      data: rateLimit,
    });
  } catch (error: any) {
    console.error('Failed to fetch rate limit:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch rate limit',
    });
  }
});

export default router;
