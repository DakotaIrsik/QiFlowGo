import { Pool } from 'pg';
import dbPool from '../database/db';

export interface DeviceToken {
  id: number;
  user_id: string;
  fcm_token: string;
  device_type: 'ios' | 'android';
  device_name?: string;
  last_used: Date;
  created_at: Date;
}

export interface CreateDeviceTokenParams {
  user_id: string;
  fcm_token: string;
  device_type: 'ios' | 'android';
  device_name?: string;
}

export class DeviceTokenModel {
  private static pool: Pool = dbPool;

  /**
   * Find all device tokens for a user
   */
  static async findByUser(userId: string): Promise<DeviceToken[]> {
    const query = `
      SELECT *
      FROM device_tokens
      WHERE user_id = $1
      ORDER BY last_used DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find device token by FCM token
   */
  static async findByToken(fcmToken: string): Promise<DeviceToken | null> {
    const query = `
      SELECT *
      FROM device_tokens
      WHERE fcm_token = $1
    `;

    const result = await this.pool.query(query, [fcmToken]);
    return result.rows[0] || null;
  }

  /**
   * Create or update device token
   */
  static async upsert(params: CreateDeviceTokenParams): Promise<DeviceToken> {
    const query = `
      INSERT INTO device_tokens (user_id, fcm_token, device_type, device_name, last_used)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (fcm_token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        device_type = EXCLUDED.device_type,
        device_name = EXCLUDED.device_name,
        last_used = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.user_id,
      params.fcm_token,
      params.device_type,
      params.device_name || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update last used timestamp
   */
  static async updateLastUsed(fcmToken: string): Promise<void> {
    const query = `
      UPDATE device_tokens
      SET last_used = NOW()
      WHERE fcm_token = $1
    `;

    await this.pool.query(query, [fcmToken]);
  }

  /**
   * Delete device token
   */
  static async delete(fcmToken: string): Promise<boolean> {
    const query = 'DELETE FROM device_tokens WHERE fcm_token = $1';
    const result = await this.pool.query(query, [fcmToken]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Delete old inactive tokens (not used in 90 days)
   */
  static async deleteInactive(daysInactive: number = 90): Promise<number> {
    const query = `
      DELETE FROM device_tokens
      WHERE last_used < NOW() - INTERVAL '${daysInactive} days'
      RETURNING id
    `;

    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }
}
