export interface GitHubActivity {
  id: string;
  swarm_id: string;
  event_type: 'commit' | 'pull_request' | 'issue' | 'check_suite';
  action?: string;
  repository: string;
  actor: string;
  title?: string;
  url: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface GitHubMetrics {
  swarm_id: string;
  repository: string;
  commits_count: number;
  open_prs_count: number;
  closed_prs_count: number;
  open_issues_count: number;
  closed_issues_count: number;
  failing_checks_count: number;
  passing_checks_count: number;
  last_commit_date?: Date;
  last_updated: Date;
}

export interface GitHubWebhookPayload {
  action?: string;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  [key: string]: any;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface CachedGitHubData<T> {
  data: T;
  cached_at: Date;
  expires_at: Date;
}
