import { Pool } from 'pg';
import dbPool from '../database/db';

export interface NotificationPreference {
  id: number;
  user_id: string;
  swarm_id?: string;
  alert_critical: boolean;
  alert_warning: boolean;
  alert_info: boolean;
  do_not_disturb_start?: string; // HH:MM format
  do_not_disturb_end?: string;   // HH:MM format
  snooze_until?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePreferenceParams {
  user_id: string;
  swarm_id?: string;
  alert_critical?: boolean;
  alert_warning?: boolean;
  alert_info?: boolean;
  do_not_disturb_start?: string;
  do_not_disturb_end?: string;
}

export interface UpdatePreferenceParams {
  alert_critical?: boolean;
  alert_warning?: boolean;
  alert_info?: boolean;
  do_not_disturb_start?: string;
  do_not_disturb_end?: string;
  snooze_until?: Date;
}

export class NotificationPreferenceModel {
  private static pool: Pool = dbPool;

  /**
   * Find preferences for a user and swarm
   */
  static async findByUserAndSwarm(
    userId: string,
    swarmId?: string
  ): Promise<NotificationPreference | null> {
    const query = `
      SELECT *
      FROM notification_preferences
      WHERE user_id = $1 AND ($2::text IS NULL OR swarm_id = $2)
      ORDER BY swarm_id NULLS LAST
      LIMIT 1
    `;

    const result = await this.pool.query(query, [userId, swarmId || null]);
    return result.rows[0] || null;
  }

  /**
   * Find all preferences for a user
   */
  static async findByUser(userId: string): Promise<NotificationPreference[]> {
    const query = `
      SELECT *
      FROM notification_preferences
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Create notification preference
   */
  static async create(params: CreatePreferenceParams): Promise<NotificationPreference> {
    const query = `
      INSERT INTO notification_preferences (
        user_id, swarm_id, alert_critical, alert_warning, alert_info,
        do_not_disturb_start, do_not_disturb_end
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.user_id,
      params.swarm_id || null,
      params.alert_critical !== undefined ? params.alert_critical : true,
      params.alert_warning !== undefined ? params.alert_warning : true,
      params.alert_info !== undefined ? params.alert_info : true,
      params.do_not_disturb_start || null,
      params.do_not_disturb_end || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update notification preference
   */
  static async update(
    id: number,
    params: UpdatePreferenceParams
  ): Promise<NotificationPreference | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.alert_critical !== undefined) {
      updates.push(`alert_critical = $${paramIndex++}`);
      values.push(params.alert_critical);
    }

    if (params.alert_warning !== undefined) {
      updates.push(`alert_warning = $${paramIndex++}`);
      values.push(params.alert_warning);
    }

    if (params.alert_info !== undefined) {
      updates.push(`alert_info = $${paramIndex++}`);
      values.push(params.alert_info);
    }

    if (params.do_not_disturb_start !== undefined) {
      updates.push(`do_not_disturb_start = $${paramIndex++}`);
      values.push(params.do_not_disturb_start);
    }

    if (params.do_not_disturb_end !== undefined) {
      updates.push(`do_not_disturb_end = $${paramIndex++}`);
      values.push(params.do_not_disturb_end);
    }

    if (params.snooze_until !== undefined) {
      updates.push(`snooze_until = $${paramIndex++}`);
      values.push(params.snooze_until);
    }

    values.push(id);

    const query = `
      UPDATE notification_preferences
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete notification preference
   */
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM notification_preferences WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if user should receive notification based on preferences
   */
  static async shouldNotify(
    userId: string,
    swarmId: string,
    alertType: 'critical' | 'warning' | 'info'
  ): Promise<boolean> {
    const pref = await this.findByUserAndSwarm(userId, swarmId);

    if (!pref) {
      // Default: send all notifications
      return true;
    }

    // Check if snoozed
    if (pref.snooze_until && new Date() < new Date(pref.snooze_until)) {
      return false;
    }

    // Check DND schedule
    if (pref.do_not_disturb_start && pref.do_not_disturb_end) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime >= pref.do_not_disturb_start && currentTime <= pref.do_not_disturb_end) {
        // During DND, only send critical alerts
        return alertType === 'critical';
      }
    }

    // Check alert type preference
    if (alertType === 'critical') return pref.alert_critical;
    if (alertType === 'warning') return pref.alert_warning;
    if (alertType === 'info') return pref.alert_info;

    return true;
  }
}
