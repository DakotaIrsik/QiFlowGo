import { Router, Request, Response } from 'express';
import { DeploymentModel } from '../models/DeploymentModel';
import { DeploymentService } from '../services/deploymentService';
import { HostModel } from '../models/HostModel';
import { SCHEDULE_PRESETS } from '../types/deployment';

const router = Router();

/**
 * Create a new deployment (draft)
 * POST /api/v1/deployments
 */
router.post('/deployments', async (req: Request, res: Response) => {
  try {
    const deployment = await DeploymentModel.create();

    res.status(201).json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update deployment step 1 - Select Host
 * PUT /api/v1/deployments/:deployment_id/step1
 */
router.put('/deployments/:deployment_id/step1', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;
    const { host_id } = req.body;

    if (!host_id) {
      return res.status(400).json({
        success: false,
        error: 'host_id is required',
      });
    }

    // Validate host exists and has capacity
    const host = await HostModel.findById(host_id);
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
      });
    }

    if (host.current_swarms >= host.capacity_max_swarms) {
      return res.status(400).json({
        success: false,
        error: 'Host has reached maximum swarm capacity',
      });
    }

    const deployment = await DeploymentModel.updateStep(deployment_id, 'step1', { host_id });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update deployment step 2 - Select GitHub Repository
 * PUT /api/v1/deployments/:deployment_id/step2
 */
router.put('/deployments/:deployment_id/step2', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;
    const { github_repo, github_owner, github_token } = req.body;

    if (!github_repo || !github_owner) {
      return res.status(400).json({
        success: false,
        error: 'github_repo and github_owner are required',
      });
    }

    const deployment = await DeploymentModel.updateStep(deployment_id, 'step2', {
      github_repo,
      github_owner,
      github_token,
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update deployment step 3 - Choose Schedule
 * PUT /api/v1/deployments/:deployment_id/step3
 */
router.put('/deployments/:deployment_id/step3', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;
    const { schedule_preset, cron_expression } = req.body;

    if (!schedule_preset && !cron_expression) {
      return res.status(400).json({
        success: false,
        error: 'Either schedule_preset or cron_expression is required',
      });
    }

    if (schedule_preset && !SCHEDULE_PRESETS[schedule_preset]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule preset',
      });
    }

    const deployment = await DeploymentModel.updateStep(deployment_id, 'step3', {
      schedule_preset,
      cron_expression,
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update deployment step 4 - Configure Agents
 * PUT /api/v1/deployments/:deployment_id/step4
 */
router.put('/deployments/:deployment_id/step4', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;
    const { agents } = req.body;

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'agents array is required and must not be empty',
      });
    }

    const deployment = await DeploymentModel.updateStep(deployment_id, 'step4', { agents });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update deployment step 5 - Customer/Billing Info
 * PUT /api/v1/deployments/:deployment_id/step5
 */
router.put('/deployments/:deployment_id/step5', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;
    const { customer_id, customer_name, project_name, billing_rate } = req.body;

    if (!customer_name || !project_name) {
      return res.status(400).json({
        success: false,
        error: 'customer_name and project_name are required',
      });
    }

    const deployment = await DeploymentModel.updateStep(deployment_id, 'step5', {
      customer_id,
      customer_name,
      project_name,
      billing_rate,
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Execute deployment
 * POST /api/v1/deployments/:deployment_id/deploy
 */
router.post('/deployments/:deployment_id/deploy', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;

    // Start deployment asynchronously
    DeploymentService.deploy(deployment_id).catch((error) => {
      console.error('Deployment failed:', error);
    });

    res.json({
      success: true,
      message: 'Deployment started',
      deployment_id,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get deployment progress
 * GET /api/v1/deployments/:deployment_id/progress
 */
router.get('/deployments/:deployment_id/progress', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;

    const progress = await DeploymentModel.getProgress(deployment_id);

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Deployment progress not found',
      });
    }

    res.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get deployment by ID
 * GET /api/v1/deployments/:deployment_id
 */
router.get('/deployments/:deployment_id', async (req: Request, res: Response) => {
  try {
    const { deployment_id } = req.params;

    const deployment = await DeploymentModel.getById(deployment_id);

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      data: deployment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get all schedule presets
 * GET /api/v1/deployments/schedule-presets
 */
router.get('/deployments/schedule-presets', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: SCHEDULE_PRESETS,
  });
});

export default router;
