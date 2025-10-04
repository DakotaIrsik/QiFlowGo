import { Router, Request, Response } from 'express';
import { hostService } from '../services/hostService';

const router = Router();

/**
 * GET /api/v1/hosts
 * Get all registered hosts
 */
router.get('/hosts', async (req: Request, res: Response) => {
  try {
    const hosts = await hostService.getAllHosts();

    res.json({
      success: true,
      data: hosts,
    });
  } catch (error) {
    console.error('Failed to fetch hosts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hosts',
    });
  }
});

/**
 * GET /api/v1/hosts/available
 * Get hosts with available capacity
 */
router.get('/hosts/available', async (req: Request, res: Response) => {
  try {
    const hosts = await hostService.getAvailableHosts();

    res.json({
      success: true,
      data: hosts,
    });
  } catch (error) {
    console.error('Failed to fetch available hosts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available hosts',
    });
  }
});

/**
 * GET /api/v1/hosts/:host_id
 * Get a specific host by ID
 */
router.get('/hosts/:host_id', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const host = await hostService.getHostById(host_id);

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
      });
    }

    res.json({
      success: true,
      data: host,
    });
  } catch (error) {
    console.error('Failed to fetch host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch host',
    });
  }
});

/**
 * POST /api/v1/hosts
 * Register a new host
 */
router.post('/hosts', async (req: Request, res: Response) => {
  try {
    const { name, hostname, port, username, os_type, ssh_key_path, capacity_max_swarms, metadata } = req.body;

    if (!name || !hostname || !username || !os_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, hostname, username, os_type',
      });
    }

    if (os_type !== 'linux' && os_type !== 'windows') {
      return res.status(400).json({
        success: false,
        error: 'os_type must be either "linux" or "windows"',
      });
    }

    const host = await hostService.registerHost({
      name,
      hostname,
      port,
      username,
      os_type,
      ssh_key_path,
      capacity_max_swarms,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: host,
    });
  } catch (error) {
    console.error('Failed to create host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create host',
    });
  }
});

/**
 * PATCH /api/v1/hosts/:host_id
 * Update host information
 */
router.patch('/hosts/:host_id', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const updates = req.body;

    const host = await hostService.updateHost(host_id, updates);

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
      });
    }

    res.json({
      success: true,
      data: host,
    });
  } catch (error) {
    console.error('Failed to update host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update host',
    });
  }
});

/**
 * DELETE /api/v1/hosts/:host_id
 * Delete a host
 */
router.delete('/hosts/:host_id', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const deleted = await hostService.removeHost(host_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Host not found',
      });
    }

    res.json({
      success: true,
      message: 'Host deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete host',
    });
  }
});

/**
 * GET /api/v1/hosts/:host_id/health
 * Check host health and connectivity
 */
router.get('/hosts/:host_id/health', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const health = await hostService.checkHostHealth(host_id);

    res.json({
      success: true,
      data: {
        host_id,
        ...health,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

/**
 * POST /api/v1/hosts/:host_id/execute
 * Execute a whitelisted command on a host
 */
router.post('/hosts/:host_id/execute', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const { command_type, input, executed_by } = req.body;

    if (!command_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: command_type',
      });
    }

    const result = await hostService.executeCommand(host_id, command_type, {
      input,
      executed_by,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Command execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed',
    });
  }
});

/**
 * GET /api/v1/hosts/:host_id/audit-logs
 * Get command audit logs for a host
 */
router.get('/hosts/:host_id/audit-logs', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await hostService.getAuditLogs(host_id, limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/v1/hosts/:host_id/available-commands
 * Get available commands for a host based on its OS
 */
router.get('/hosts/:host_id/available-commands', async (req: Request, res: Response) => {
  try {
    const { host_id } = req.params;
    const commands = await hostService.getAvailableCommands(host_id);
    const host = await hostService.getHostById(host_id);

    res.json({
      success: true,
      data: {
        host_id,
        os_type: host?.os_type,
        available_commands: commands,
      },
    });
  } catch (error) {
    console.error('Failed to fetch available commands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available commands',
    });
  }
});

export default router;
