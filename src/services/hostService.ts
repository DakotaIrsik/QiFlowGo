import { randomUUID } from 'crypto';
import { HostModel } from '../models/HostModel';
import { Host, CreateHostParams, UpdateHostParams, CommandAuditLog } from '../types/host';
import { sshConnectionPool } from './sshConnectionPool';
import { remoteCommandService } from './remoteCommandService';

export class HostService {
  /**
   * Register a new host
   */
  async registerHost(params: Omit<CreateHostParams, 'host_id'>): Promise<Host> {
    // Generate host_id if not provided
    const host_id = randomUUID();

    // Validate required fields
    if (!params.name || !params.hostname || !params.username) {
      throw new Error('Missing required fields: name, hostname, username');
    }

    // Create the host
    const host = await HostModel.create({
      ...params,
      host_id,
    });

    // Test SSH connection
    try {
      const canConnect = await sshConnectionPool.testConnection(host_id);
      if (canConnect) {
        await HostModel.updateLastSeen(host_id, 'online');
      } else {
        await HostModel.update({ host_id, status: 'offline' });
      }
    } catch (error) {
      // Mark as error if connection test fails
      await HostModel.update({ host_id, status: 'error' });
    }

    return HostModel.findById(host_id) as Promise<Host>;
  }

  /**
   * Get all registered hosts
   */
  async getAllHosts(): Promise<Host[]> {
    return HostModel.findAll();
  }

  /**
   * Get host by ID
   */
  async getHostById(host_id: string): Promise<Host | null> {
    return HostModel.findById(host_id);
  }

  /**
   * Update host information
   */
  async updateHost(host_id: string, updates: Omit<UpdateHostParams, 'host_id'>): Promise<Host | null> {
    return HostModel.update({ host_id, ...updates });
  }

  /**
   * Remove a host
   */
  async removeHost(host_id: string): Promise<boolean> {
    // Close any existing SSH connections
    await sshConnectionPool.closeConnection(host_id);

    // Delete from database
    return HostModel.delete(host_id);
  }

  /**
   * Execute remote command on a host
   */
  async executeCommand(
    host_id: string,
    commandType: string,
    options: { input?: string; executed_by?: string } = {}
  ) {
    // Validate host exists
    const host = await HostModel.findById(host_id);
    if (!host) {
      throw new Error(`Host not found: ${host_id}`);
    }

    // Execute the command
    return remoteCommandService.executeCommand(host_id, commandType, options);
  }

  /**
   * Get available hosts with capacity
   */
  async getAvailableHosts(): Promise<Host[]> {
    return HostModel.findAvailable();
  }

  /**
   * Check host health
   */
  async checkHostHealth(host_id: string): Promise<{ healthy: boolean; message: string }> {
    try {
      const canConnect = await sshConnectionPool.testConnection(host_id);

      if (canConnect) {
        await HostModel.updateLastSeen(host_id, 'online');
        return { healthy: true, message: 'Host is online and reachable' };
      } else {
        await HostModel.update({ host_id, status: 'offline' });
        return { healthy: false, message: 'Host is unreachable' };
      }
    } catch (error) {
      await HostModel.update({ host_id, status: 'error' });
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get command audit logs for a host
   */
  async getAuditLogs(host_id: string, limit: number = 100): Promise<CommandAuditLog[]> {
    return HostModel.getAuditLogs(host_id, limit);
  }

  /**
   * Get available commands for a host
   */
  async getAvailableCommands(host_id: string): Promise<string[]> {
    const host = await HostModel.findById(host_id);
    if (!host) {
      throw new Error(`Host not found: ${host_id}`);
    }

    return remoteCommandService.getAvailableCommands(host.os_type);
  }

  /**
   * Update settings on a remote host
   */
  async updateRemoteSettings(
    host_id: string,
    settingsContent: string,
    executed_by?: string
  ) {
    return remoteCommandService.updateSettings(host_id, settingsContent, executed_by);
  }

  /**
   * Stream logs from a remote host
   */
  async streamLogs(
    host_id: string,
    onData: (data: string) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    return remoteCommandService.streamLogs(host_id, onData, onError);
  }
}

// Singleton instance
export const hostService = new HostService();
