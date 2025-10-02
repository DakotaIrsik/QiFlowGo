import { Client } from 'ssh2';
import { DeploymentModel } from '../models/DeploymentModel';
import { HostModel } from '../models/HostModel';
import { SwarmModel } from '../models/SwarmModel';
import { DeploymentConfig, SCHEDULE_PRESETS } from '../types/deployment';

export class DeploymentService {
  /**
   * Execute deployment
   */
  static async deploy(deployment_id: string): Promise<void> {
    const deployment = await DeploymentModel.getById(deployment_id);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Update status to deploying
    await DeploymentModel.updateStatus(deployment_id, 'deploying');
    await DeploymentModel.createProgress(deployment_id);

    try {
      // Step 1: Validate host
      await this.logProgress(deployment_id, 'Validating host...', 10);
      const host = await HostModel.findById(deployment.step1.host_id);
      if (!host) {
        throw new Error('Host not found');
      }

      if (host.current_swarms >= host.capacity_max_swarms) {
        throw new Error('Host has reached maximum swarm capacity');
      }

      // Step 2: Validate GitHub repository
      await this.logProgress(deployment_id, 'Validating GitHub repository...', 20);
      // TODO: Implement GitHub API validation

      // Step 3: Generate settings.ini
      await this.logProgress(deployment_id, 'Generating configuration...', 30);
      const settingsIni = this.generateSettingsIni(deployment);

      // Step 4: Connect to host via SSH
      await this.logProgress(deployment_id, 'Connecting to host via SSH...', 40);
      const sshClient = await this.connectSSH(host.hostname, host.port, host.username);

      // Step 5: Create deployment directory
      await this.logProgress(deployment_id, 'Creating deployment directory...', 50);
      const deployDir = `/home/${host.username}/qiflow-swarms/${deployment.step5.project_name}`;
      await this.execSSH(sshClient, `mkdir -p ${deployDir}`);

      // Step 6: Upload settings.ini
      await this.logProgress(deployment_id, 'Uploading configuration...', 60);
      await this.uploadFile(sshClient, settingsIni, `${deployDir}/settings.ini`);

      // Step 7: Clone repository
      await this.logProgress(deployment_id, 'Cloning repository...', 70);
      const repoUrl = `https://github.com/${deployment.step2.github_owner}/${deployment.step2.github_repo}.git`;
      await this.execSSH(sshClient, `cd ${deployDir} && git clone ${repoUrl} repo`);

      // Step 8: Install dependencies
      await this.logProgress(deployment_id, 'Installing dependencies...', 80);
      await this.execSSH(sshClient, `cd ${deployDir}/repo && pip install -r requirements.txt`);

      // Step 9: Start swarm
      await this.logProgress(deployment_id, 'Starting swarm...', 90);
      const startCommand = this.generateStartCommand(deployment, deployDir);
      await this.execSSH(sshClient, startCommand);

      // Step 10: Register swarm in database
      await this.logProgress(deployment_id, 'Registering swarm...', 95);
      const swarm_id = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const swarmHostUrl = `http://${host.hostname}:8080`;

      await SwarmModel.create({
        swarm_id,
        name: deployment.step5.project_name,
        host_url: swarmHostUrl,
      });

      // Increment host's active swarms
      await HostModel.update({
        host_id: deployment.step1.host_id,
        current_swarms: host.current_swarms + 1,
      });

      // Cleanup
      sshClient.end();

      // Mark deployment as complete
      await this.logProgress(deployment_id, 'Deployment completed successfully!', 100);
      await DeploymentModel.updateProgress(deployment_id, { status: 'deployed' });
      await DeploymentModel.updateStatus(deployment_id, 'deployed');
    } catch (error: any) {
      await DeploymentModel.updateProgress(deployment_id, {
        status: 'failed',
        error: error.message,
      });
      await DeploymentModel.updateStatus(deployment_id, 'failed');
      throw error;
    }
  }

  /**
   * Generate settings.ini file content
   */
  private static generateSettingsIni(deployment: DeploymentConfig): string {
    const schedule = deployment.step3.schedule_preset
      ? SCHEDULE_PRESETS[deployment.step3.schedule_preset].cron_expression
      : deployment.step3.cron_expression || '* * * * *';

    const agentRoles = deployment.step4.agents
      .map((agent) => agent.role)
      .join(',');

    return `[project]
name=${deployment.step5.project_name}
customer=${deployment.step5.customer_name}

[github]
repo=${deployment.step2.github_owner}/${deployment.step2.github_repo}
token=${deployment.step2.github_token || ''}

[schedule]
cron=${schedule}

[agents]
roles=${agentRoles}

[heartbeat]
monitor_url=\${MONITOR_URL}
api_key=\${API_KEY}
interval=60
enable_api=true
api_port=8080

[project_tracking]
enabled=true
flag_blocked_after_hours=24
flag_failures_threshold=3
flag_test_failure_rate=0.10
`;
  }

  /**
   * Generate start command for swarm
   */
  private static generateStartCommand(deployment: DeploymentConfig, deployDir: string): string {
    return `cd ${deployDir}/repo && nohup python -m core.heartbeat > ${deployDir}/heartbeat.log 2>&1 & nohup python -m core.api_server > ${deployDir}/api.log 2>&1 &`;
  }

  /**
   * Connect to host via SSH
   */
  private static connectSSH(hostname: string, port: number, username: string): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        resolve(conn);
      });

      conn.on('error', (err) => {
        reject(err);
      });

      // TODO: In production, use SSH key authentication instead of password
      conn.connect({
        host: hostname,
        port,
        username,
        // privateKey: ... (load from secure storage)
      });
    });
  }

  /**
   * Execute SSH command
   */
  private static execSSH(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
          } else {
            resolve(output);
          }
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  /**
   * Upload file via SSH
   */
  private static uploadFile(client: Client, content: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        const stream = sftp.createWriteStream(remotePath);

        stream.on('close', () => {
          resolve();
        });

        stream.on('error', (error) => {
          reject(error);
        });

        stream.write(content);
        stream.end();
      });
    });
  }

  /**
   * Log deployment progress
   */
  private static async logProgress(
    deployment_id: string,
    message: string,
    progress_percent: number
  ): Promise<void> {
    await DeploymentModel.updateProgress(deployment_id, {
      log: `[${new Date().toISOString()}] ${message}`,
      progress_percent,
      current_step: message,
    });
  }
}
