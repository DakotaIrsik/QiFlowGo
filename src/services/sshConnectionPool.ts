import { Client, ConnectConfig } from 'ssh2';
import { HostModel } from '../models/HostModel';
import { Host, SSHConnection } from '../types/host';
import * as fs from 'fs';

interface PooledConnection {
  client: Client;
  host_id: string;
  connected: boolean;
  last_used: Date;
  in_use: boolean;
}

export class SSHConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private maxIdleTime: number = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove stale connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60 * 1000); // Run every minute
  }

  /**
   * Get or create an SSH connection for a host
   */
  async getConnection(host_id: string): Promise<Client> {
    // Check if we already have a connection
    const existing = this.connections.get(host_id);
    if (existing && existing.connected && !existing.in_use) {
      existing.in_use = true;
      existing.last_used = new Date();
      return existing.client;
    }

    // Create a new connection
    const host = await HostModel.findById(host_id);
    if (!host) {
      throw new Error(`Host not found: ${host_id}`);
    }

    const client = await this.createConnection(host);

    const pooledConnection: PooledConnection = {
      client,
      host_id,
      connected: true,
      last_used: new Date(),
      in_use: true,
    };

    this.connections.set(host_id, pooledConnection);
    return client;
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(host_id: string): void {
    const connection = this.connections.get(host_id);
    if (connection) {
      connection.in_use = false;
      connection.last_used = new Date();
    }
  }

  /**
   * Create a new SSH connection
   */
  private async createConnection(host: Host): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const config: ConnectConfig = {
        host: host.hostname,
        port: host.port,
        username: host.username,
      };

      // Add SSH key if provided
      if (host.ssh_key_path) {
        try {
          config.privateKey = fs.readFileSync(host.ssh_key_path);
        } catch (error) {
          reject(new Error(`Failed to read SSH key: ${error}`));
          return;
        }
      }

      client.on('ready', () => {
        resolve(client);
      });

      client.on('error', (err) => {
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      client.on('close', () => {
        const connection = this.connections.get(host.host_id);
        if (connection) {
          connection.connected = false;
        }
      });

      // Set connection timeout
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('SSH connection timeout'));
      }, 30000); // 30 seconds

      client.connect(config);

      client.on('ready', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Close a specific connection
   */
  async closeConnection(host_id: string): Promise<void> {
    const connection = this.connections.get(host_id);
    if (connection) {
      connection.client.end();
      this.connections.delete(host_id);
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const [host_id, connection] of this.connections) {
      connection.client.end();
    }
    this.connections.clear();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove connections that have been idle for too long
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();

    for (const [host_id, connection] of this.connections) {
      if (!connection.in_use && (now - connection.last_used.getTime()) > this.maxIdleTime) {
        connection.client.end();
        this.connections.delete(host_id);
      }
    }
  }

  /**
   * Get connection status
   */
  getStatus(): SSHConnection[] {
    return Array.from(this.connections.values()).map(conn => ({
      host_id: conn.host_id,
      connected: conn.connected,
      last_used: conn.last_used,
    }));
  }

  /**
   * Test connection to a host
   */
  async testConnection(host_id: string): Promise<boolean> {
    try {
      const client = await this.getConnection(host_id);
      this.releaseConnection(host_id);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const sshConnectionPool = new SSHConnectionPool();
