import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { DeviceTokenModel } from '../models/DeviceTokenModel';
import { NotificationPreferenceModel } from '../models/NotificationPreferenceModel';
import { AlertRuleModel } from '../models/AlertRuleModel';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

/**
 * Register device token for push notifications
 * POST /api/v1/notifications/tokens
 */
router.post(
  '/tokens',
  [
    body('fcm_token').isString().trim().notEmpty(),
    body('device_type').isIn(['ios', 'android']),
    body('device_name').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user?.uid || 'anonymous';
      const { fcm_token, device_type, device_name } = req.body;

      const token = await DeviceTokenModel.upsert({
        user_id: userId,
        fcm_token,
        device_type,
        device_name,
      });

      res.status(201).json({
        message: 'Device token registered successfully',
        token,
      });
    } catch (error) {
      console.error('[NotificationRoutes] Error registering token:', error);
      res.status(500).json({ error: 'Failed to register device token' });
    }
  }
);

/**
 * Delete device token
 * DELETE /api/v1/notifications/tokens/:fcm_token
 */
router.delete('/tokens/:fcm_token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fcm_token } = req.params;
    const deleted = await DeviceTokenModel.delete(fcm_token);

    if (!deleted) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ message: 'Device token deleted successfully' });
  } catch (error) {
    console.error('[NotificationRoutes] Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
});

/**
 * Subscribe to swarm notifications
 * POST /api/v1/notifications/swarms/:swarm_id/subscribe
 */
router.post(
  '/swarms/:swarm_id/subscribe',
  [
    param('swarm_id').isString(),
    body('fcm_token').isString().trim().notEmpty(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { swarm_id } = req.params;
      const { fcm_token } = req.body;

      await NotificationService.subscribeToSwarm(fcm_token, swarm_id);

      res.json({ message: `Subscribed to swarm ${swarm_id}` });
    } catch (error) {
      console.error('[NotificationRoutes] Error subscribing to swarm:', error);
      res.status(500).json({ error: 'Failed to subscribe to swarm' });
    }
  }
);

/**
 * Unsubscribe from swarm notifications
 * POST /api/v1/notifications/swarms/:swarm_id/unsubscribe
 */
router.post(
  '/swarms/:swarm_id/unsubscribe',
  [
    param('swarm_id').isString(),
    body('fcm_token').isString().trim().notEmpty(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { swarm_id } = req.params;
      const { fcm_token } = req.body;

      await NotificationService.unsubscribeFromSwarm(fcm_token, swarm_id);

      res.json({ message: `Unsubscribed from swarm ${swarm_id}` });
    } catch (error) {
      console.error('[NotificationRoutes] Error unsubscribing from swarm:', error);
      res.status(500).json({ error: 'Failed to unsubscribe from swarm' });
    }
  }
);

/**
 * Get notification preferences for user
 * GET /api/v1/notifications/preferences
 */
router.get('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    const preferences = await NotificationPreferenceModel.findByUser(userId);

    res.json({ preferences });
  } catch (error) {
    console.error('[NotificationRoutes] Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * Get notification preferences for specific swarm
 * GET /api/v1/notifications/preferences/:swarm_id
 */
router.get('/preferences/:swarm_id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    const { swarm_id } = req.params;

    const preference = await NotificationPreferenceModel.findByUserAndSwarm(
      userId,
      swarm_id
    );

    if (!preference) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    res.json({ preference });
  } catch (error) {
    console.error('[NotificationRoutes] Error fetching preference:', error);
    res.status(500).json({ error: 'Failed to fetch notification preference' });
  }
});

/**
 * Create or update notification preferences
 * POST /api/v1/notifications/preferences
 */
router.post(
  '/preferences',
  [
    body('swarm_id').optional().isString(),
    body('alert_critical').optional().isBoolean(),
    body('alert_warning').optional().isBoolean(),
    body('alert_info').optional().isBoolean(),
    body('do_not_disturb_start').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
    body('do_not_disturb_end').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user?.uid || 'anonymous';
      const {
        swarm_id,
        alert_critical,
        alert_warning,
        alert_info,
        do_not_disturb_start,
        do_not_disturb_end,
      } = req.body;

      // Check if preference exists
      const existing = await NotificationPreferenceModel.findByUserAndSwarm(
        userId,
        swarm_id
      );

      let preference;
      if (existing) {
        preference = await NotificationPreferenceModel.update(existing.id, {
          alert_critical,
          alert_warning,
          alert_info,
          do_not_disturb_start,
          do_not_disturb_end,
        });
      } else {
        preference = await NotificationPreferenceModel.create({
          user_id: userId,
          swarm_id,
          alert_critical,
          alert_warning,
          alert_info,
          do_not_disturb_start,
          do_not_disturb_end,
        });
      }

      res.status(existing ? 200 : 201).json({
        message: existing ? 'Preferences updated' : 'Preferences created',
        preference,
      });
    } catch (error) {
      console.error('[NotificationRoutes] Error saving preferences:', error);
      res.status(500).json({ error: 'Failed to save notification preferences' });
    }
  }
);

/**
 * Snooze notifications for a swarm
 * POST /api/v1/notifications/snooze/:swarm_id
 */
router.post(
  '/snooze/:swarm_id',
  [
    param('swarm_id').isString(),
    body('duration_minutes').isInt({ min: 1, max: 1440 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user?.uid || 'anonymous';
      const { swarm_id } = req.params;
      const { duration_minutes } = req.body;

      const snoozeUntil = new Date(Date.now() + duration_minutes * 60 * 1000);

      let preference = await NotificationPreferenceModel.findByUserAndSwarm(
        userId,
        swarm_id
      );

      if (!preference) {
        preference = await NotificationPreferenceModel.create({
          user_id: userId,
          swarm_id,
        });
      }

      await NotificationPreferenceModel.update(preference.id, {
        snooze_until: snoozeUntil,
      });

      res.json({
        message: `Notifications snoozed until ${snoozeUntil.toISOString()}`,
        snooze_until: snoozeUntil,
      });
    } catch (error) {
      console.error('[NotificationRoutes] Error snoozing notifications:', error);
      res.status(500).json({ error: 'Failed to snooze notifications' });
    }
  }
);

/**
 * Get alert rules for a swarm
 * GET /api/v1/notifications/alert-rules/:swarm_id
 */
router.get('/alert-rules/:swarm_id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { swarm_id } = req.params;
    const rules = await AlertRuleModel.findBySwarm(swarm_id);

    res.json({ rules });
  } catch (error) {
    console.error('[NotificationRoutes] Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

/**
 * Update alert rule
 * PATCH /api/v1/notifications/alert-rules/:rule_id
 */
router.patch(
  '/alert-rules/:rule_id',
  [
    param('rule_id').isInt(),
    body('enabled').optional().isBoolean(),
    body('threshold_value').optional().isFloat(),
    body('threshold_unit').optional().isString(),
    body('cooldown_minutes').optional().isInt({ min: 0 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { rule_id } = req.params;
      const { enabled, threshold_value, threshold_unit, cooldown_minutes } = req.body;

      const rule = await AlertRuleModel.update(parseInt(rule_id), {
        enabled,
        threshold_value,
        threshold_unit,
        cooldown_minutes,
      });

      if (!rule) {
        return res.status(404).json({ error: 'Alert rule not found' });
      }

      res.json({ message: 'Alert rule updated', rule });
    } catch (error) {
      console.error('[NotificationRoutes] Error updating alert rule:', error);
      res.status(500).json({ error: 'Failed to update alert rule' });
    }
  }
);

export default router;
