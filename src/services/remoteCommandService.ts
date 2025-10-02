import { Client } from 'ssh2';
import { sshConnectionPool } from './sshConnectionPool';
import { HostModel } from '../models/HostModel';
import { RemoteCommandResult } from '../types/host';

export interface CommandWhitelist {
  [key: string]: {
    linux: string[];
    windows: string[];
  };
}

// Whitelisted commands with OS-specific implementations
const COMMAND_WHITELIST: CommandWhitelist = {
  restart_swarm: {
    linux: [
      'sudo systemctl restart qiflow',
      'cd /opt/qiflow && ./restart.sh',
    ],
    windows: [
      'powershell -Command "Restart-Service QiFlow"',
      'powershell -Command "& {cd C:\\QiFlow; .\\restart.bat}"',
    ],
  },
  update_settings: {
    linux: [
      'cat > /opt/qiflow/settings.ini',
    ],
    windows: [
      'powershell -Command "Set-Content -Path C:\\QiFlow\\settings.ini"',
    ],
  },
  get_logs: {
    linux: [
      'tail -n 100 /opt/qiflow/logs/qiflow.log',
      'journalctl -u qiflow -n 100',
    ],
    windows: [
      'powershell -Command "Get-Content C:\\QiFlow\\logs\\qiflow.log -Tail 100"',
    ],
  },
  check_status: {
    linux: [
      'systemctl status qiflow',
      'ps aux | grep qiflow',
    ],
    windows: [
      'powershell -Command "Get-Service QiFlow"',
      'powershell -Command "Get-Process | Where-Object {$_.Name -like \'*qiflow*\'}"',
    ],
  },
  stop_swarm: {
    linux: [
      'sudo systemctl stop qiflow',
      'cd /opt/qiflow && ./stop.sh',
    ],
    windows: [
      'powershell -Command "Stop-Service QiFlow"',
      'powershell -Command "& {cd C:\\QiFlow; .\\stop.bat}"',
    ],
  },
  start_swarm: {
    linux: [
      'sudo systemctl start qiflow',
      'cd /opt/qiflow && ./start.sh',
    ],
    windows: [
      'powershell -Command "Start-Service QiFlow"',
      'powershell -Command "& {cd C:\\QiFlow; .\\start.bat}"',
    ],
  },
};

export class RemoteCommandService {
  /**
   * Execute a whitelisted command on a remote host
   */
  async executeCommand(
    host_id: string,
    commandType: string,
    options: { input?: string; executed_by?: string } = {}
  ): Promise<RemoteCommandResult> {
    const startTime = Date.now();

    try {
      // Validate command is whitelisted
      if (!COMMAND_WHITELIST[commandType]) {
        throw new Error(`Command type '${commandType}' is not whitelisted`);
      }

      // Get host info
      const host = await HostModel.findById(host_id);
      if (!host) {
        throw new Error(`Host not found: ${host_id}`);
      }

      // Get the appropriate command for the OS
      const commands = COMMAND_WHITELIST[commandType][host.os_type];
      if (!commands || commands.length === 0) {
        throw new Error(`No command defined for ${commandType} on ${host.os_type}`);
      }

      // Use the first available command
      const command = commands[0];

      // Get SSH connection
      const client = await sshConnectionPool.getConnection(host_id);

      try {
        // Execute the command
        const result = await this.executeOnClient(client, command, options.input);

        // Update host last seen
        await HostModel.updateLastSeen(host_id, 'online');

        // Log the command execution
        await HostModel.createAuditLog({
          host_id,
          command: commandType,
          executed_by: options.executed_by,
          exit_code: result.exit_code,
          output: result.stdout,
          error: result.stderr,
          duration_ms: result.duration_ms,
          success: result.success,
        });

        return result;
      } finally {
        // Release connection back to pool
        sshConnectionPool.releaseConnection(host_id);
      }
    } catch (error) {
      const duration_ms = Date.now() - startTime;

      // Log failed execution
      await HostModel.createAuditLog({
        host_id,
        command: commandType,
        executed_by: options.executed_by,
        error: error instanceof Error ? error.message : String(error),
        duration_ms,
        success: false,
      });

      throw error;
    }
  }

  /**
   * Execute a command on an SSH client
   */
  private executeOnClient(
    client: Client,
    command: string,
    input?: string
  ): Promise<RemoteCommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        // If input is provided, write it to stdin
        if (input) {
          stream.write(input);
          stream.end();
        }

        stream.on('close', (code: number) => {
          const duration_ms = Date.now() - startTime;

          resolve({
            success: code === 0,
            exit_code: code,
            stdout,
            stderr,
            duration_ms,
          });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (error: Error) => {
          reject(error);
        });
      });
    });
  }

  /**
   * Stream logs from a remote host
   */
  async streamLogs(
    host_id: string,
    onData: (data: string) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const host = await HostModel.findById(host_id);
    if (!host) {
      throw new Error(`Host not found: ${host_id}`);
    }

    const client = await sshConnectionPool.getConnection(host_id);

    const logCommand = host.os_type === 'linux'
      ? 'tail -f /opt/qiflow/logs/qiflow.log'
      : 'powershell -Command "Get-Content C:\\QiFlow\\logs\\qiflow.log -Wait"';

    client.exec(logCommand, (err, stream) => {
      if (err) {
        onError(err);
        sshConnectionPool.releaseConnection(host_id);
        return;
      }

      stream.on('data', (data: Buffer) => {
        onData(data.toString());
      });

      stream.stderr.on('data', (data: Buffer) => {
        onError(new Error(data.toString()));
      });

      stream.on('close', () => {
        sshConnectionPool.releaseConnection(host_id);
      });
    });

    // Return cleanup function
    return () => {
      sshConnectionPool.closeConnection(host_id);
    };
  }

  /**
   * Update settings.ini on a remote host
   */
  async updateSettings(
    host_id: string,
    settingsContent: string,
    executed_by?: string
  ): Promise<RemoteCommandResult> {
    return this.executeCommand(host_id, 'update_settings', {
      input: settingsContent,
      executed_by,
    });
  }

  /**
   * Get available commands for a host
   */
  getAvailableCommands(os_type: 'linux' | 'windows'): string[] {
    return Object.keys(COMMAND_WHITELIST).filter(commandType => {
      const commands = COMMAND_WHITELIST[commandType][os_type];
      return commands && commands.length > 0;
    });
  }

  /**
   * Validate if a command type is whitelisted
   */
  isCommandWhitelisted(commandType: string): boolean {
    return !!COMMAND_WHITELIST[commandType];
  }
}

// Singleton instance
export const remoteCommandService = new RemoteCommandService();
