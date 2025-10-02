import pool from '../database/db';
import { DeploymentConfig, DeploymentProgress } from '../types/deployment';

export class DeploymentModel {
  /**
   * Create a new deployment configuration (draft)
   */
  static async create(): Promise<DeploymentConfig> {
    const deployment_id = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      `INSERT INTO deployments (deployment_id, status, config, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [deployment_id, 'draft', JSON.stringify({})]
    );

    return this.mapToDeploymentConfig(result.rows[0]);
  }

  /**
   * Update deployment step data
   */
  static async updateStep(
    deployment_id: string,
    step: string,
    data: any
  ): Promise<DeploymentConfig | null> {
    const result = await pool.query(
      `UPDATE deployments
       SET config = jsonb_set(config::jsonb, '{${step}}', $1::jsonb),
           updated_at = NOW()
       WHERE deployment_id = $2
       RETURNING *`,
      [JSON.stringify(data), deployment_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDeploymentConfig(result.rows[0]);
  }

  /**
   * Get deployment by ID
   */
  static async getById(deployment_id: string): Promise<DeploymentConfig | null> {
    const result = await pool.query(
      'SELECT * FROM deployments WHERE deployment_id = $1',
      [deployment_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDeploymentConfig(result.rows[0]);
  }

  /**
   * Update deployment status
   */
  static async updateStatus(
    deployment_id: string,
    status: 'draft' | 'deploying' | 'deployed' | 'failed'
  ): Promise<DeploymentConfig | null> {
    const result = await pool.query(
      `UPDATE deployments
       SET status = $1, updated_at = NOW()
       WHERE deployment_id = $2
       RETURNING *`,
      [status, deployment_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDeploymentConfig(result.rows[0]);
  }

  /**
   * Create deployment progress record
   */
  static async createProgress(deployment_id: string): Promise<DeploymentProgress> {
    const result = await pool.query(
      `INSERT INTO deployment_progress (deployment_id, status, current_step, progress_percent, logs, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [deployment_id, 'deploying', 'initializing', 0, JSON.stringify([])]
    );

    return this.mapToDeploymentProgress(result.rows[0]);
  }

  /**
   * Update deployment progress
   */
  static async updateProgress(
    deployment_id: string,
    params: {
      status?: 'deploying' | 'deployed' | 'failed';
      current_step?: string;
      progress_percent?: number;
      log?: string;
      error?: string;
    }
  ): Promise<DeploymentProgress | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.current_step !== undefined) {
      updates.push(`current_step = $${paramIndex++}`);
      values.push(params.current_step);
    }

    if (params.progress_percent !== undefined) {
      updates.push(`progress_percent = $${paramIndex++}`);
      values.push(params.progress_percent);
    }

    if (params.log !== undefined) {
      updates.push(`logs = logs::jsonb || $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([params.log]));
    }

    if (params.error !== undefined) {
      updates.push(`error = $${paramIndex++}`);
      values.push(params.error);
    }

    updates.push(`updated_at = NOW()`);
    values.push(deployment_id);

    const result = await pool.query(
      `UPDATE deployment_progress
       SET ${updates.join(', ')}
       WHERE deployment_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDeploymentProgress(result.rows[0]);
  }

  /**
   * Get deployment progress
   */
  static async getProgress(deployment_id: string): Promise<DeploymentProgress | null> {
    const result = await pool.query(
      'SELECT * FROM deployment_progress WHERE deployment_id = $1',
      [deployment_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDeploymentProgress(result.rows[0]);
  }

  /**
   * Map database row to DeploymentConfig object
   */
  private static mapToDeploymentConfig(row: any): DeploymentConfig {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    return {
      deployment_id: row.deployment_id,
      step1: config.step1 || {},
      step2: config.step2 || {},
      step3: config.step3 || {},
      step4: config.step4 || {},
      step5: config.step5 || {},
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Map database row to DeploymentProgress object
   */
  private static mapToDeploymentProgress(row: any): DeploymentProgress {
    const logs = typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs;

    return {
      deployment_id: row.deployment_id,
      status: row.status,
      current_step: row.current_step,
      progress_percent: row.progress_percent,
      logs: logs || [],
      error: row.error,
    };
  }
}
