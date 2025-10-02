import { Pool } from 'pg';
import pool from '../database/db';

export interface VelocityMetric {
  id: number;
  swarm_id: string;
  date: string;
  issues_closed: number;
  issues_opened: number;
  net_progress: number;
  avg_completion_time_hours: number | null;
  created_at: Date;
}

export interface IssueCompletion {
  id: number;
  swarm_id: string;
  issue_number: number;
  closed_at: Date;
  time_to_complete_hours: number | null;
  assigned_agent: string | null;
  created_at: Date;
}

export class VelocityMetricsModel {
  private static pool: Pool = pool;

  /**
   * Find velocity metrics for a swarm within a date range
   */
  static async findBySwarmAndDateRange(
    swarmId: string,
    startDate: string,
    endDate: string
  ): Promise<VelocityMetric[]> {
    const query = `
      SELECT
        id,
        swarm_id,
        date,
        issues_closed,
        issues_opened,
        net_progress,
        avg_completion_time_hours,
        created_at
      FROM velocity_metrics
      WHERE swarm_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date DESC
    `;

    const result = await this.pool.query(query, [swarmId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Upsert daily velocity metrics
   */
  static async upsert(
    swarmId: string,
    date: string,
    issuesClosed: number,
    issuesOpened: number,
    avgCompletionTimeHours: number | null
  ): Promise<VelocityMetric> {
    const netProgress = issuesClosed - issuesOpened;

    const query = `
      INSERT INTO velocity_metrics (
        swarm_id, date, issues_closed, issues_opened,
        net_progress, avg_completion_time_hours
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (swarm_id, date)
      DO UPDATE SET
        issues_closed = $3,
        issues_opened = $4,
        net_progress = $5,
        avg_completion_time_hours = $6
      RETURNING
        id,
        swarm_id,
        date,
        issues_closed,
        issues_opened,
        net_progress,
        avg_completion_time_hours,
        created_at
    `;

    const result = await this.pool.query(query, [
      swarmId,
      date,
      issuesClosed,
      issuesOpened,
      netProgress,
      avgCompletionTimeHours,
    ]);

    return result.rows[0];
  }

  /**
   * Record an issue completion
   */
  static async recordCompletion(
    swarmId: string,
    issueNumber: number,
    closedAt: Date,
    timeToCompleteHours: number | null,
    assignedAgent: string | null
  ): Promise<IssueCompletion> {
    const query = `
      INSERT INTO issue_completions (
        swarm_id, issue_number, closed_at,
        time_to_complete_hours, assigned_agent
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        swarm_id,
        issue_number,
        closed_at,
        time_to_complete_hours,
        assigned_agent,
        created_at
    `;

    const result = await this.pool.query(query, [
      swarmId,
      issueNumber,
      closedAt,
      timeToCompleteHours,
      assignedAgent,
    ]);

    return result.rows[0];
  }

  /**
   * Get issue completions for a swarm within a date range
   */
  static async getCompletionsByDateRange(
    swarmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IssueCompletion[]> {
    const query = `
      SELECT
        id,
        swarm_id,
        issue_number,
        closed_at,
        time_to_complete_hours,
        assigned_agent,
        created_at
      FROM issue_completions
      WHERE swarm_id = $1
        AND closed_at >= $2
        AND closed_at < $3
      ORDER BY closed_at DESC
    `;

    const result = await this.pool.query(query, [swarmId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Get all swarm IDs that have velocity data
   */
  static async getAllSwarmIds(): Promise<string[]> {
    const query = `
      SELECT DISTINCT swarm_id
      FROM velocity_metrics
      ORDER BY swarm_id
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => row.swarm_id);
  }
}
