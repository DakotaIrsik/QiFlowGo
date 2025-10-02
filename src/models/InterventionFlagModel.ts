import { query } from '../database/db';
import {
  InterventionFlag,
  CreateInterventionFlagParams,
  ResolveInterventionFlagParams,
  InterventionFlagQuery,
  InterventionFlagCount,
  AgentFailure,
  IssueStatusHistory,
} from '../types/interventionFlag';
import { NotificationService } from '../services/notificationService';

export class InterventionFlagModel {
  /**
   * Create a new intervention flag
   */
  static async create(params: CreateInterventionFlagParams): Promise<InterventionFlag> {
    const sql = `
      INSERT INTO intervention_flags (
        swarm_id, issue_number, github_url, priority, reason,
        trigger_type, agent_message, blocked_duration_hours,
        failure_count, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (swarm_id, issue_number, trigger_type)
      DO UPDATE SET
        priority = EXCLUDED.priority,
        reason = EXCLUDED.reason,
        agent_message = EXCLUDED.agent_message,
        blocked_duration_hours = EXCLUDED.blocked_duration_hours,
        failure_count = EXCLUDED.failure_count,
        metadata = EXCLUDED.metadata,
        flagged_at = NOW()
      RETURNING *
    `;

    const values = [
      params.swarm_id,
      params.issue_number,
      params.github_url,
      params.priority,
      params.reason,
      params.trigger_type,
      params.agent_message,
      params.blocked_duration_hours,
      params.failure_count,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ];

    const result = await query(sql, values);
    const flag = this.mapRowToFlag(result.rows[0]);

    // Send push notification for new flag
    await NotificationService.sendInterventionNotification(flag);

    return flag;
  }

  /**
   * Find flags by query parameters
   */
  static async find(params: InterventionFlagQuery): Promise<InterventionFlag[]> {
    let sql = `
      SELECT * FROM intervention_flags
      WHERE swarm_id = $1
    `;

    const values: any[] = [params.swarm_id];
    let paramIndex = 2;

    if (params.priority) {
      sql += ` AND priority = $${paramIndex}`;
      values.push(params.priority);
      paramIndex++;
    }

    if (params.resolved !== undefined) {
      if (params.resolved) {
        sql += ` AND resolved_at IS NOT NULL`;
      } else {
        sql += ` AND resolved_at IS NULL`;
      }
    }

    sql += ` ORDER BY flagged_at DESC`;

    if (params.limit) {
      sql += ` LIMIT $${paramIndex}`;
      values.push(params.limit);
      paramIndex++;
    }

    if (params.offset) {
      sql += ` OFFSET $${paramIndex}`;
      values.push(params.offset);
    }

    const result = await query(sql, values);
    return result.rows.map((row: any) => this.mapRowToFlag(row));
  }

  /**
   * Get count of unresolved flags by priority
   */
  static async getCount(swarmId: string): Promise<InterventionFlagCount> {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE priority = 'critical' AND resolved_at IS NULL) as critical,
        COUNT(*) FILTER (WHERE priority = 'review' AND resolved_at IS NULL) as review,
        COUNT(*) FILTER (WHERE resolved_at IS NULL) as total
      FROM intervention_flags
      WHERE swarm_id = $1
    `;

    const result = await query(sql, [swarmId]);
    const row = result.rows[0];

    return {
      critical: parseInt(row.critical),
      review: parseInt(row.review),
      total: parseInt(row.total),
    };
  }

  /**
   * Resolve an intervention flag
   */
  static async resolve(params: ResolveInterventionFlagParams): Promise<InterventionFlag | null> {
    const sql = `
      UPDATE intervention_flags
      SET
        resolved_at = NOW(),
        resolved_by = $1,
        resolution_note = $2
      WHERE id = $3 AND resolved_at IS NULL
      RETURNING *
    `;

    const values = [params.resolved_by, params.resolution_note, params.flag_id];
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFlag(result.rows[0]);
  }

  /**
   * Bulk resolve multiple flags
   */
  static async bulkResolve(flagIds: number[], resolvedBy: string, resolutionNote?: string): Promise<number> {
    const sql = `
      UPDATE intervention_flags
      SET
        resolved_at = NOW(),
        resolved_by = $1,
        resolution_note = $2
      WHERE id = ANY($3) AND resolved_at IS NULL
    `;

    const result = await query(sql, [resolvedBy, resolutionNote, flagIds]);
    return result.rowCount || 0;
  }

  /**
   * Delete a flag (unflag)
   */
  static async delete(flagId: number): Promise<boolean> {
    const sql = `DELETE FROM intervention_flags WHERE id = $1`;
    const result = await query(sql, [flagId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Track agent failure
   */
  static async trackAgentFailure(
    swarmId: string,
    issueNumber: number,
    agentName?: string,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    // Record the failure
    const insertSql = `
      INSERT INTO agent_failures (swarm_id, issue_number, agent_name, error_message, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await query(insertSql, [
      swarmId,
      issueNumber,
      agentName,
      errorMessage,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    // Count consecutive failures in the last 24 hours
    const countSql = `
      SELECT COUNT(*) as count
      FROM agent_failures
      WHERE swarm_id = $1
        AND issue_number = $2
        AND failed_at > NOW() - INTERVAL '24 hours'
      ORDER BY failed_at DESC
    `;

    const result = await query(countSql, [swarmId, issueNumber]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Track issue status change
   */
  static async trackStatusChange(
    swarmId: string,
    issueNumber: number,
    status: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const sql = `
      INSERT INTO issue_status_history (swarm_id, issue_number, status, metadata)
      VALUES ($1, $2, $3, $4)
    `;

    await query(sql, [swarmId, issueNumber, status, metadata ? JSON.stringify(metadata) : null]);
  }

  /**
   * Get time since issue became blocked
   */
  static async getBlockedDuration(swarmId: string, issueNumber: number): Promise<number | null> {
    const sql = `
      SELECT changed_at
      FROM issue_status_history
      WHERE swarm_id = $1
        AND issue_number = $2
        AND status = 'blocked'
      ORDER BY changed_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [swarmId, issueNumber]);

    if (result.rows.length === 0) {
      return null;
    }

    const blockedAt = new Date(result.rows[0].changed_at);
    const now = new Date();
    const durationMs = now.getTime() - blockedAt.getTime();
    return Math.floor(durationMs / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Map database row to InterventionFlag object
   */
  private static mapRowToFlag(row: any): InterventionFlag {
    return {
      id: row.id,
      swarm_id: row.swarm_id,
      issue_number: row.issue_number,
      github_url: row.github_url,
      priority: row.priority,
      reason: row.reason,
      trigger_type: row.trigger_type,
      agent_message: row.agent_message,
      blocked_duration_hours: row.blocked_duration_hours,
      failure_count: row.failure_count,
      flagged_at: row.flagged_at,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
      resolution_note: row.resolution_note,
      metadata: row.metadata,
    };
  }
}
