import { Pool } from 'pg';
import dbPool from '../database/db';
import { Host, CreateHostParams, UpdateHostParams, CommandAuditLog, CreateAuditLogParams } from '../types/host';

export class HostModel {
  private static pool: Pool = dbPool;

  /**
   * Find all hosts
   */
  static async findAll(): Promise<Host[]> {
    const query = `
      SELECT
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        status,
        last_seen,
        ssh_key_path,
        capacity_max_swarms,
        current_swarms,
        metadata,
        created_at,
        updated_at
      FROM hosts
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Find a host by ID
   */
  static async findById(host_id: string): Promise<Host | null> {
    const query = `
      SELECT
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        status,
        last_seen,
        ssh_key_path,
        capacity_max_swarms,
        current_swarms,
        metadata,
        created_at,
        updated_at
      FROM hosts
      WHERE host_id = $1
    `;

    const result = await this.pool.query(query, [host_id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new host
   */
  static async create(params: CreateHostParams): Promise<Host> {
    const query = `
      INSERT INTO hosts (
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        ssh_key_path,
        capacity_max_swarms,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        status,
        last_seen,
        ssh_key_path,
        capacity_max_swarms,
        current_swarms,
        metadata,
        created_at,
        updated_at
    `;

    const result = await this.pool.query(query, [
      params.host_id,
      params.name,
      params.hostname,
      params.port || 22,
      params.username,
      params.os_type,
      params.ssh_key_path || null,
      params.capacity_max_swarms || 5,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);

    return result.rows[0];
  }

  /**
   * Update host information
   */
  static async update(params: UpdateHostParams): Promise<Host | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }

    if (params.hostname !== undefined) {
      updates.push(`hostname = $${paramIndex++}`);
      values.push(params.hostname);
    }

    if (params.port !== undefined) {
      updates.push(`port = $${paramIndex++}`);
      values.push(params.port);
    }

    if (params.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(params.username);
    }

    if (params.os_type !== undefined) {
      updates.push(`os_type = $${paramIndex++}`);
      values.push(params.os_type);
    }

    if (params.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.ssh_key_path !== undefined) {
      updates.push(`ssh_key_path = $${paramIndex++}`);
      values.push(params.ssh_key_path);
    }

    if (params.capacity_max_swarms !== undefined) {
      updates.push(`capacity_max_swarms = $${paramIndex++}`);
      values.push(params.capacity_max_swarms);
    }

    if (params.current_swarms !== undefined) {
      updates.push(`current_swarms = $${paramIndex++}`);
      values.push(params.current_swarms);
    }

    if (params.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(params.metadata));
    }

    values.push(params.host_id);

    const query = `
      UPDATE hosts
      SET ${updates.join(', ')}
      WHERE host_id = $${paramIndex}
      RETURNING
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        status,
        last_seen,
        ssh_key_path,
        capacity_max_swarms,
        current_swarms,
        metadata,
        created_at,
        updated_at
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update host last seen timestamp and status
   */
  static async updateLastSeen(host_id: string, status: 'online' | 'offline' | 'error' = 'online'): Promise<void> {
    const query = `
      UPDATE hosts
      SET last_seen = NOW(), status = $2
      WHERE host_id = $1
    `;

    await this.pool.query(query, [host_id, status]);
  }

  /**
   * Delete a host
   */
  static async delete(host_id: string): Promise<boolean> {
    const query = 'DELETE FROM hosts WHERE host_id = $1';
    const result = await this.pool.query(query, [host_id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get hosts with available capacity
   */
  static async findAvailable(): Promise<Host[]> {
    const query = `
      SELECT
        host_id,
        name,
        hostname,
        port,
        username,
        os_type,
        status,
        last_seen,
        ssh_key_path,
        capacity_max_swarms,
        current_swarms,
        metadata,
        created_at,
        updated_at
      FROM hosts
      WHERE status = 'online'
        AND current_swarms < capacity_max_swarms
      ORDER BY (capacity_max_swarms - current_swarms) DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Create audit log entry
   */
  static async createAuditLog(params: CreateAuditLogParams): Promise<CommandAuditLog> {
    const query = `
      INSERT INTO command_audit_log (
        host_id,
        command,
        executed_by,
        exit_code,
        output,
        error,
        duration_ms,
        success,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        host_id,
        command,
        executed_by,
        executed_at,
        exit_code,
        output,
        error,
        duration_ms,
        success,
        metadata
    `;

    const result = await this.pool.query(query, [
      params.host_id,
      params.command,
      params.executed_by || null,
      params.exit_code !== undefined ? params.exit_code : null,
      params.output || null,
      params.error || null,
      params.duration_ms !== undefined ? params.duration_ms : null,
      params.success !== undefined ? params.success : null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);

    return result.rows[0];
  }

  /**
   * Get audit logs for a host
   */
  static async getAuditLogs(host_id: string, limit: number = 100): Promise<CommandAuditLog[]> {
    const query = `
      SELECT
        id,
        host_id,
        command,
        executed_by,
        executed_at,
        exit_code,
        output,
        error,
        duration_ms,
        success,
        metadata
      FROM command_audit_log
      WHERE host_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [host_id, limit]);
    return result.rows;
  }
}
