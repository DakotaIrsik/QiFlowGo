import axios from 'axios';
import { InterventionFlagModel } from '../models/InterventionFlagModel';
import { VelocityService } from './velocityService';

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  closed_at: string | null;
  html_url: string;
}

export interface IssueBreakdown {
  total_issues: number;
  completed_issues: number;
  in_progress_issues: number;
  ready_issues: number;
  blocked_issues: number;
}

export interface InterventionSummary {
  issue_number: number;
  title: string;
  priority: 'critical' | 'review';
  blocked_duration_hours: number;
  agent_message: string;
  github_url: string;
}

export interface VelocityTrend {
  issues_per_day: number;
  last_7_days: number[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ProjectCompletionData {
  completion_percentage: number;
  total_issues: number;
  completed_issues: number;
  in_progress_issues: number;
  ready_issues: number;
  blocked_issues: number;
  issues_requiring_human_intervention: InterventionSummary[];
  velocity_trend: VelocityTrend;
  estimated_completion_date: string;
  confidence_level: number;
}

export class ProjectCompletionService {
  /**
   * Fetch GitHub issues for a repository
   */
  private static async fetchGitHubIssues(
    owner: string,
    repo: string,
    githubToken?: string
  ): Promise<GitHubIssue[]> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    try {
      // Fetch all issues (both open and closed)
      const allIssues: GitHubIssue[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const [openResponse, closedResponse] = await Promise.all([
          axios.get(
            `https://api.github.com/repos/${owner}/${repo}/issues`,
            {
              headers,
              params: {
                state: 'open',
                per_page: perPage,
                page,
              },
            }
          ),
          axios.get(
            `https://api.github.com/repos/${owner}/${repo}/issues`,
            {
              headers,
              params: {
                state: 'closed',
                per_page: perPage,
                page,
              },
            }
          ),
        ]);

        const openIssues = openResponse.data.filter((issue: any) => !issue.pull_request);
        const closedIssues = closedResponse.data.filter((issue: any) => !issue.pull_request);

        allIssues.push(...openIssues, ...closedIssues);

        // Check if we've reached the last page
        if (openIssues.length < perPage && closedIssues.length < perPage) {
          break;
        }

        page++;
      }

      return allIssues;
    } catch (error: any) {
      console.error('Error fetching GitHub issues:', error.message);
      throw new Error(`Failed to fetch GitHub issues: ${error.message}`);
    }
  }

  /**
   * Categorize issues by status
   */
  private static categorizeIssues(issues: GitHubIssue[]): IssueBreakdown {
    const completed = issues.filter((issue) => issue.state === 'closed');

    // Categorize open issues
    const openIssues = issues.filter((issue) => issue.state === 'open');

    const inProgress = openIssues.filter((issue) =>
      issue.labels.some(
        (label) =>
          label.name.toLowerCase().includes('in progress') ||
          label.name.toLowerCase().includes('in-progress') ||
          label.name.toLowerCase().includes('wip')
      )
    );

    const blocked = openIssues.filter((issue) =>
      issue.labels.some(
        (label) =>
          label.name.toLowerCase().includes('blocked') ||
          label.name.toLowerCase().includes('human')
      )
    );

    const ready = openIssues.filter(
      (issue) =>
        !inProgress.some((ip) => ip.number === issue.number) &&
        !blocked.some((b) => b.number === issue.number)
    );

    return {
      total_issues: issues.length,
      completed_issues: completed.length,
      in_progress_issues: inProgress.length,
      ready_issues: ready.length,
      blocked_issues: blocked.length,
    };
  }

  /**
   * Get project completion data for a swarm
   */
  static async getProjectCompletion(
    swarmId: string,
    githubOwner: string,
    githubRepo: string,
    githubToken?: string
  ): Promise<ProjectCompletionData> {
    // Fetch GitHub issues
    const issues = await this.fetchGitHubIssues(githubOwner, githubRepo, githubToken);

    // Categorize issues
    const breakdown = this.categorizeIssues(issues);

    // Calculate completion percentage
    const completionPercentage = breakdown.total_issues > 0
      ? Math.round((breakdown.completed_issues / breakdown.total_issues) * 100)
      : 0;

    // Get intervention flags
    const flags = await InterventionFlagModel.find({
      swarm_id: swarmId,
      resolved: false,
    });

    const interventions: InterventionSummary[] = flags.map((flag: any) => {
      // Find the corresponding GitHub issue
      const githubIssue = issues.find((issue) => issue.number === flag.issue_number);

      return {
        issue_number: flag.issue_number,
        title: githubIssue?.title || `Issue #${flag.issue_number}`,
        priority: flag.priority,
        blocked_duration_hours: flag.blocked_duration_hours || 0,
        agent_message: flag.agent_message || flag.reason,
        github_url: flag.github_url || githubIssue?.html_url || `https://github.com/${githubOwner}/${githubRepo}/issues/${flag.issue_number}`,
      };
    });

    // Get velocity and forecast
    const velocity = await VelocityService.calculateVelocity(swarmId, 7);
    const trend = VelocityService.detectTrend(velocity.last_n_days);
    const forecast = await VelocityService.generateForecast(
      swarmId,
      breakdown.total_issues,
      breakdown.completed_issues
    );

    return {
      completion_percentage: completionPercentage,
      total_issues: breakdown.total_issues,
      completed_issues: breakdown.completed_issues,
      in_progress_issues: breakdown.in_progress_issues,
      ready_issues: breakdown.ready_issues,
      blocked_issues: breakdown.blocked_issues,
      issues_requiring_human_intervention: interventions,
      velocity_trend: {
        issues_per_day: velocity.issues_per_day,
        last_7_days: velocity.last_n_days,
        trend: trend.trend,
      },
      estimated_completion_date: forecast.estimated_completion_date,
      confidence_level: forecast.confidence_level,
    };
  }
}
