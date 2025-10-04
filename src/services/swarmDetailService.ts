import { Octokit } from '@octokit/rest';
import { SwarmModel } from '../models/SwarmModel';
import { hostService } from './hostService';
import { v4 as uuidv4 } from 'uuid';

export interface ActivityFeedItem {
  id: string;
  type: 'commit' | 'pr' | 'issue' | 'test';
  title: string;
  description: string;
  author: string;
  timestamp: string;
  url: string;
  metadata?: {
    branch?: string;
    pr_number?: number;
    issue_number?: number;
    status?: string;
    test_results?: {
      passed: number;
      failed: number;
      skipped: number;
    };
  };
}

export interface AgentStatus {
  agent_id: string;
  name: string;
  status: 'active' | 'idle' | 'offline' | 'error';
  current_task?: string;
  last_activity: string;
  uptime_seconds: number;
}

export interface ResourceMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_rx_mbps: number;
  network_tx_mbps: number;
  api_quota_used: number;
  api_quota_limit: number;
  timestamp: string;
}

export interface SwarmSchedule {
  enabled: boolean;
  cron_expression: string;
  timezone: string;
  next_run: string;
  last_run?: string;
}

export interface IssueBoard {
  ready: IssueBoardItem[];
  in_progress: IssueBoardItem[];
  blocked: IssueBoardItem[];
  done: IssueBoardItem[];
}

export interface IssueBoardItem {
  issue_number: number;
  title: string;
  labels: string[];
  assignee?: string;
  updated_at: string;
  url: string;
}

export interface SSHConnectionDetails {
  hostname: string;
  port: number;
  username: string;
  auth_type: 'key' | 'password';
  key_path?: string;
  has_password: boolean;
  os_type: string;
}

export interface SSHCommand {
  command: string;
  copyable_text: string;
  deep_link_ios?: string;
  deep_link_android?: string;
}

export interface SSHProfile {
  profile_id: string;
  profile_name: string;
  ssh_client?: string;
  custom_port?: number;
  custom_username?: string;
  created_at: string;
  updated_at: string;
}

// In-memory storage for SSH profiles (replace with database in production)
const sshProfiles: Map<string, SSHProfile[]> = new Map();

export class SwarmDetailService {
  /**
   * Get activity feed for a swarm
   * Fetches recent commits, PRs, issues, and test runs from GitHub
   */
  static async getActivityFeed(
    swarm_id: string,
    github_owner: string,
    github_repo: string,
    github_token?: string,
    limit: number = 20
  ): Promise<ActivityFeedItem[]> {
    const octokit = new Octokit({ auth: github_token });
    const activities: ActivityFeedItem[] = [];

    try {
      // Fetch recent commits
      const { data: commits } = await octokit.repos.listCommits({
        owner: github_owner,
        repo: github_repo,
        per_page: Math.min(limit, 10),
      });

      for (const commit of commits) {
        activities.push({
          id: `commit-${commit.sha}`,
          type: 'commit',
          title: commit.commit.message.split('\n')[0],
          description: commit.commit.message,
          author: commit.commit.author?.name || 'Unknown',
          timestamp: commit.commit.author?.date || new Date().toISOString(),
          url: commit.html_url,
          metadata: {
            branch: 'main', // GitHub API doesn't provide branch in commit list
          },
        });
      }

      // Fetch recent PRs
      const { data: prs } = await octokit.pulls.list({
        owner: github_owner,
        repo: github_repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(limit, 10),
      });

      for (const pr of prs) {
        activities.push({
          id: `pr-${pr.number}`,
          type: 'pr',
          title: pr.title,
          description: pr.body || '',
          author: pr.user?.login || 'Unknown',
          timestamp: pr.updated_at,
          url: pr.html_url,
          metadata: {
            pr_number: pr.number,
            status: pr.state,
            branch: pr.head.ref,
          },
        });
      }

      // Fetch recent issues
      const { data: issues } = await octokit.issues.listForRepo({
        owner: github_owner,
        repo: github_repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(limit, 10),
      });

      for (const issue of issues) {
        // Skip pull requests (GitHub API includes PRs in issues)
        if (issue.pull_request) continue;

        activities.push({
          id: `issue-${issue.number}`,
          type: 'issue',
          title: issue.title,
          description: issue.body || '',
          author: issue.user?.login || 'Unknown',
          timestamp: issue.updated_at,
          url: issue.html_url,
          metadata: {
            issue_number: issue.number,
            status: issue.state,
          },
        });
      }

      // Sort all activities by timestamp (newest first)
      activities.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Return only the requested limit
      return activities.slice(0, limit);
    } catch (error: any) {
      throw new Error(`Failed to fetch activity feed: ${error.message}`);
    }
  }

  /**
   * Get agent status for a swarm
   * Returns mock data for now - will be replaced with actual agent monitoring
   */
  static async getAgentStatus(swarm_id: string): Promise<AgentStatus[]> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Mock agent data - will be replaced with actual agent monitoring
    const agents: AgentStatus[] = [];
    const activeAgents = swarm.active_agents || 0;

    for (let i = 0; i < Math.max(activeAgents, 3); i++) {
      agents.push({
        agent_id: `agent-${i + 1}`,
        name: `Agent ${i + 1}`,
        status: i < activeAgents ? 'active' : 'idle',
        current_task: i < activeAgents ? `Working on issue #${Math.floor(Math.random() * 100)}` : undefined,
        last_activity: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        uptime_seconds: Math.floor(Math.random() * 86400),
      });
    }

    return agents;
  }

  /**
   * Get resource metrics for a swarm
   * Returns current metrics from swarm health status
   */
  static async getResourceMetrics(swarm_id: string): Promise<ResourceMetrics> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const healthStatus = swarm.health_status || {
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
    };

    return {
      cpu_percent: healthStatus.cpu_percent || 0,
      memory_percent: healthStatus.memory_percent || 0,
      disk_percent: healthStatus.disk_percent || 0,
      network_rx_mbps: 0, // Not currently tracked
      network_tx_mbps: 0, // Not currently tracked
      api_quota_used: 0, // Not currently tracked
      api_quota_limit: 5000, // GitHub default
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get schedule configuration for a swarm
   * Returns mock data for now - will be replaced with actual schedule storage
   */
  static async getSchedule(swarm_id: string): Promise<SwarmSchedule> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Mock schedule data - will be replaced with actual schedule storage
    return {
      enabled: true,
      cron_expression: '0 */4 * * *', // Every 4 hours
      timezone: 'UTC',
      next_run: new Date(Date.now() + 3600000).toISOString(),
      last_run: new Date(Date.now() - 3600000).toISOString(),
    };
  }

  /**
   * Update schedule configuration for a swarm
   */
  static async updateSchedule(
    swarm_id: string,
    schedule: Partial<SwarmSchedule>
  ): Promise<SwarmSchedule> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // TODO: Store schedule in database
    // For now, just return the provided schedule merged with defaults
    return {
      enabled: schedule.enabled ?? true,
      cron_expression: schedule.cron_expression || '0 */4 * * *',
      timezone: schedule.timezone || 'UTC',
      next_run: new Date(Date.now() + 3600000).toISOString(),
      last_run: schedule.last_run,
    };
  }

  /**
   * Get issue board for a swarm (Kanban view)
   * Fetches issues from GitHub and organizes by status
   */
  static async getIssueBoard(
    swarm_id: string,
    github_owner: string,
    github_repo: string,
    github_token?: string
  ): Promise<IssueBoard> {
    const octokit = new Octokit({ auth: github_token });

    try {
      const { data: issues } = await octokit.issues.listForRepo({
        owner: github_owner,
        repo: github_repo,
        state: 'all',
        per_page: 100,
      });

      const board: IssueBoard = {
        ready: [],
        in_progress: [],
        blocked: [],
        done: [],
      };

      for (const issue of issues) {
        // Skip pull requests
        if (issue.pull_request) continue;

        const item: IssueBoardItem = {
          issue_number: issue.number,
          title: issue.title,
          labels: issue.labels.map((label: any) =>
            typeof label === 'string' ? label : label.name
          ),
          assignee: issue.assignee?.login,
          updated_at: issue.updated_at,
          url: issue.html_url,
        };

        // Categorize by state and labels
        if (issue.state === 'closed') {
          board.done.push(item);
        } else if (item.labels.some(l => l.toLowerCase().includes('blocked'))) {
          board.blocked.push(item);
        } else if (item.labels.some(l => l.toLowerCase().includes('in progress') || l.toLowerCase().includes('wip'))) {
          board.in_progress.push(item);
        } else if (issue.assignee) {
          board.in_progress.push(item);
        } else {
          board.ready.push(item);
        }
      }

      return board;
    } catch (error: any) {
      throw new Error(`Failed to fetch issue board: ${error.message}`);
    }
  }

  /**
   * Get SSH connection details for a swarm's host
   * Used by mobile app SSH Quick Connect (Issue #10)
   */
  static async getSSHConnectionDetails(swarm_id: string): Promise<SSHConnectionDetails> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Extract hostname from host_url
    const hostUrl = new URL(swarm.host_url);
    const hostname = hostUrl.hostname;

    // Try to get host details from host service
    // This assumes the swarm's host_url hostname matches a registered host
    const hosts = await hostService.getAllHosts();
    const matchingHost = hosts.find(h => h.hostname === hostname);

    if (matchingHost) {
      return {
        hostname: matchingHost.hostname,
        port: matchingHost.port || 22,
        username: matchingHost.username,
        auth_type: matchingHost.ssh_key_path ? 'key' : 'password',
        key_path: matchingHost.ssh_key_path,
        has_password: !matchingHost.ssh_key_path,
        os_type: matchingHost.os_type,
      };
    }

    // Fallback: return basic connection info from host_url
    return {
      hostname,
      port: parseInt(hostUrl.port) || 22,
      username: 'root', // Default username
      auth_type: 'password',
      has_password: true,
      os_type: 'linux',
    };
  }

  /**
   * Get formatted SSH command for a swarm
   * Used by mobile app SSH Quick Connect (Issue #10)
   */
  static async getSSHCommand(swarm_id: string, use_key: boolean = false): Promise<SSHCommand> {
    const connectionDetails = await this.getSSHConnectionDetails(swarm_id);

    let command = `ssh ${connectionDetails.username}@${connectionDetails.hostname}`;

    if (connectionDetails.port !== 22) {
      command += ` -p ${connectionDetails.port}`;
    }

    if (use_key && connectionDetails.key_path) {
      command += ` -i ${connectionDetails.key_path}`;
    }

    // Generate deep links for mobile SSH clients
    const deep_link_ios = `termius://host/${connectionDetails.hostname}?port=${connectionDetails.port}&user=${connectionDetails.username}`;
    const deep_link_android = `jssh://${connectionDetails.username}@${connectionDetails.hostname}:${connectionDetails.port}`;

    return {
      command,
      copyable_text: command,
      deep_link_ios,
      deep_link_android,
    };
  }

  /**
   * Get SSH profiles for a swarm
   * Used by mobile app SSH Quick Connect (Issue #10)
   */
  static async getSSHProfiles(swarm_id: string): Promise<SSHProfile[]> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Get profiles from in-memory storage (replace with database)
    return sshProfiles.get(swarm_id) || [];
  }

  /**
   * Save SSH profile for a swarm
   * Used by mobile app SSH Quick Connect (Issue #10)
   */
  static async saveSSHProfile(
    swarm_id: string,
    profileData: {
      profile_name: string;
      ssh_client?: string;
      custom_port?: number;
      custom_username?: string;
    }
  ): Promise<SSHProfile> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const profile: SSHProfile = {
      profile_id: uuidv4(),
      profile_name: profileData.profile_name,
      ssh_client: profileData.ssh_client,
      custom_port: profileData.custom_port,
      custom_username: profileData.custom_username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store in in-memory storage (replace with database)
    const existingProfiles = sshProfiles.get(swarm_id) || [];
    existingProfiles.push(profile);
    sshProfiles.set(swarm_id, existingProfiles);

    return profile;
  }

  /**
   * Delete SSH profile
   * Used by mobile app SSH Quick Connect (Issue #10)
   */
  static async deleteSSHProfile(swarm_id: string, profile_id: string): Promise<boolean> {
    const swarm = await SwarmModel.findById(swarm_id);

    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Delete from in-memory storage (replace with database)
    const existingProfiles = sshProfiles.get(swarm_id) || [];
    const filteredProfiles = existingProfiles.filter(p => p.profile_id !== profile_id);

    if (existingProfiles.length === filteredProfiles.length) {
      return false; // Profile not found
    }

    sshProfiles.set(swarm_id, filteredProfiles);
    return true;
  }
}
