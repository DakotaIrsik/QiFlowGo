import { Pool } from 'pg';
import { db } from '../database/db';
import { SwarmStatus, CreateSwarmParams, UpdateSwarmStatusParams } from '../types/swarm';

export class SwarmModel {
  private static pool: Pool = db;

  /**
   * Find all swarms
   */
  static async findAll(): Promise<SwarmStatus[]> {
    const query = `
      SELECT
        swarm_id,
        name,
        host_url,
        status,
        last_seen,
        health_status,
        active_agents,
        project_completion,
        created_at,
        updated_at
      FROM swarms
      ORDER BY last_seen DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Find a swarm by ID
   */
  static async findById(swarm_id: string): Promise<SwarmStatus | null> {
    const query = `
      SELECT
        swarm_id,
        name,
        host_url,
        status,
        last_seen,
        health_status,
        active_agents,
        project_completion,
        created_at,
        updated_at
      FROM swarms
      WHERE swarm_id = $1
    `;

    const result = await this.pool.query(query, [swarm_id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new swarm
   */
  static async create(params: CreateSwarmParams): Promise<SwarmStatus> {
    const query = `
      INSERT INTO swarms (swarm_id, name, host_url, status, last_seen)
      VALUES ($1, $2, $3, 'offline', NOW())
      RETURNING
        swarm_id,
        name,
        host_url,
        status,
        last_seen,
        health_status,
        active_agents,
        project_completion,
        created_at,
        updated_at
    `;

    const result = await this.pool.query(query, [
      params.swarm_id,
      params.name,
      params.host_url,
    ]);

    return result.rows[0];
  }

  /**
   * Update swarm status and metrics
   */
  static async updateStatus(params: UpdateSwarmStatusParams): Promise<SwarmStatus | null> {
    const updates: string[] = ['last_seen = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.health_status) {
      updates.push(`health_status = $${paramIndex++}`);
      values.push(JSON.stringify(params.health_status));
    }

    if (params.active_agents !== undefined) {
      updates.push(`active_agents = $${paramIndex++}`);
      values.push(params.active_agents);
    }

    if (params.project_completion !== undefined) {
      updates.push(`project_completion = $${paramIndex++}`);
      values.push(params.project_completion);
    }

    values.push(params.swarm_id);

    const query = `
      UPDATE swarms
      SET ${updates.join(', ')}
      WHERE swarm_id = $${paramIndex}
      RETURNING
        swarm_id,
        name,
        host_url,
        status,
        last_seen,
        health_status,
        active_agents,
        project_completion,
        created_at,
        updated_at
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Mark swarm as offline if not seen in specified seconds
   */
  static async markStaleAsOffline(staleSeconds: number = 60): Promise<number> {
    const query = `
      UPDATE swarms
      SET status = 'offline'
      WHERE last_seen < NOW() - INTERVAL '${staleSeconds} seconds'
        AND status != 'offline'
      RETURNING swarm_id
    `;

    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Delete a swarm
   */
  static async delete(swarm_id: string): Promise<boolean> {
    const query = 'DELETE FROM swarms WHERE swarm_id = $1';
    const result = await this.pool.query(query, [swarm_id]);
    return (result.rowCount || 0) > 0;
  }
}
