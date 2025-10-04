import { Pool } from 'pg';
import dbPool from '../database/db';
import { AlertEvent, AlertType } from '../services/notificationService';

export interface AlertRule {
  id: number;
  swarm_id?: string;
  alert_event: AlertEvent;
  alert_type: AlertType;
  enabled: boolean;
  threshold_value?: number;
  threshold_unit?: string;
  cooldown_minutes: number;
  last_triggered?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertRuleParams {
  swarm_id?: string;
  alert_event: AlertEvent;
  alert_type: AlertType;
  enabled?: boolean;
  threshold_value?: number;
  threshold_unit?: string;
  cooldown_minutes?: number;
}

export interface UpdateAlertRuleParams {
  enabled?: boolean;
  threshold_value?: number;
  threshold_unit?: string;
  cooldown_minutes?: number;
}

export class AlertRuleModel {
  private static pool: Pool = dbPool;

  /**
   * Find all alert rules for a swarm
   */
  static async findBySwarm(swarmId?: string): Promise<AlertRule[]> {
    const query = `
      SELECT *
      FROM alert_rules
      WHERE $1::text IS NULL OR swarm_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [swarmId || null]);
    return result.rows;
  }

  /**
   * Find enabled alert rules by event type
   */
  static async findEnabledByEvent(
    alertEvent: AlertEvent,
    swarmId?: string
  ): Promise<AlertRule[]> {
    const query = `
      SELECT *
      FROM alert_rules
      WHERE alert_event = $1
        AND enabled = true
        AND ($2::text IS NULL OR swarm_id = $2)
        AND (
          last_triggered IS NULL
          OR last_triggered < NOW() - INTERVAL '1 minute' * cooldown_minutes
        )
    `;

    const result = await this.pool.query(query, [alertEvent, swarmId || null]);
    return result.rows;
  }

  /**
   * Find alert rule by ID
   */
  static async findById(id: number): Promise<AlertRule | null> {
    const query = 'SELECT * FROM alert_rules WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Create alert rule
   */
  static async create(params: CreateAlertRuleParams): Promise<AlertRule> {
    const query = `
      INSERT INTO alert_rules (
        swarm_id, alert_event, alert_type, enabled,
        threshold_value, threshold_unit, cooldown_minutes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.swarm_id || null,
      params.alert_event,
      params.alert_type,
      params.enabled !== undefined ? params.enabled : true,
      params.threshold_value || null,
      params.threshold_unit || null,
      params.cooldown_minutes !== undefined ? params.cooldown_minutes : 15,
    ]);

    return result.rows[0];
  }

  /**
   * Update alert rule
   */
  static async update(
    id: number,
    params: UpdateAlertRuleParams
  ): Promise<AlertRule | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(params.enabled);
    }

    if (params.threshold_value !== undefined) {
      updates.push(`threshold_value = $${paramIndex++}`);
      values.push(params.threshold_value);
    }

    if (params.threshold_unit !== undefined) {
      updates.push(`threshold_unit = $${paramIndex++}`);
      values.push(params.threshold_unit);
    }

    if (params.cooldown_minutes !== undefined) {
      updates.push(`cooldown_minutes = $${paramIndex++}`);
      values.push(params.cooldown_minutes);
    }

    values.push(id);

    const query = `
      UPDATE alert_rules
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Mark rule as triggered
   */
  static async markTriggered(id: number): Promise<void> {
    const query = `
      UPDATE alert_rules
      SET last_triggered = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Delete alert rule
   */
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM alert_rules WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Create default alert rules for a new swarm
   */
  static async createDefaults(swarmId: string): Promise<AlertRule[]> {
    const defaults: CreateAlertRuleParams[] = [
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.SWARM_OFFLINE,
        alert_type: AlertType.CRITICAL,
        cooldown_minutes: 15,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.API_QUOTA_EXHAUSTED,
        alert_type: AlertType.CRITICAL,
        threshold_value: 90,
        threshold_unit: 'percent',
        cooldown_minutes: 60,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.DISK_CRITICAL,
        alert_type: AlertType.CRITICAL,
        threshold_value: 90,
        threshold_unit: 'percent',
        cooldown_minutes: 30,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.TEST_COVERAGE_DROP,
        alert_type: AlertType.WARNING,
        threshold_value: 5,
        threshold_unit: 'percent',
        cooldown_minutes: 120,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.HIGH_RESOURCE_USAGE,
        alert_type: AlertType.WARNING,
        threshold_value: 80,
        threshold_unit: 'percent',
        cooldown_minutes: 30,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.MILESTONE_COMPLETED,
        alert_type: AlertType.INFO,
        cooldown_minutes: 0,
      },
      {
        swarm_id: swarmId,
        alert_event: AlertEvent.PR_MERGED,
        alert_type: AlertType.INFO,
        cooldown_minutes: 0,
      },
    ];

    const created: AlertRule[] = [];
    for (const rule of defaults) {
      created.push(await this.create(rule));
    }

    return created;
  }
}
