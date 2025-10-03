import { Octokit } from '@octokit/rest';
import { GitHubActivity, GitHubMetrics, GitHubRateLimit, CachedGitHubData } from '../types/github';
import { query } from '../database/db';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_THRESHOLD = 100; // Remaining requests before backoff

class GitHubService {
  private octokit: Octokit;
  private rateLimitInfo: GitHubRateLimit | null = null;

  constructor() {
    const token = process.env.GITHUB_TOKEN || '';
    this.octokit = new Octokit({
      auth: token,
    });
    this.initializeCacheTable();
  }

  /**
   * Initialize the cache table if it doesn't exist
   */
  private async initializeCacheTable(): Promise<void> {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS github_cache (
          cache_key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL
        )
      `);

      // Create index on expires_at for efficient cleanup
      await query(`
        CREATE INDEX IF NOT EXISTS idx_github_cache_expires_at
        ON github_cache(expires_at)
      `);
    } catch (error) {
      console.error('Failed to initialize GitHub cache table:', error);
    }
  }

  /**
   * Get or update rate limit information
   */
  async getRateLimit(): Promise<GitHubRateLimit> {
    try {
      const response = await this.octokit.rateLimit.get();
      this.rateLimitInfo = {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: new Date(response.data.rate.reset * 1000),
        used: response.data.rate.used,
      };
      return this.rateLimitInfo;
    } catch (error) {
      console.error('Failed to get rate limit:', error);
      throw error;
    }
  }

  /**
   * Check if we should make API calls or wait
   */
  async shouldMakeApiCall(): Promise<boolean> {
    if (!this.rateLimitInfo) {
      await this.getRateLimit();
    }

    if (this.rateLimitInfo && this.rateLimitInfo.remaining < RATE_LIMIT_THRESHOLD) {
      const now = new Date();
      if (now < this.rateLimitInfo.reset) {
        console.warn(`Rate limit low (${this.rateLimitInfo.remaining} remaining). Reset at ${this.rateLimitInfo.reset}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get cached data or fetch fresh data
   */
  private async getCachedOrFetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = await this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check rate limit before fetching
    if (!(await this.shouldMakeApiCall())) {
      throw new Error('GitHub API rate limit reached. Please try again later.');
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Cache the result
    await this.saveToCache(cacheKey, data);

    return data;
  }

  /**
   * Get data from cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const result = await query(
        `SELECT data FROM github_cache
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [key]
      );

      if (result.rows.length > 0) {
        return result.rows[0].data as T;
      }
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Save data to cache
   */
  private async saveToCache<T>(key: string, data: T): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await query(
        `INSERT INTO github_cache (cache_key, data, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (cache_key)
         DO UPDATE SET data = $2, cached_at = NOW(), expires_at = $3`,
        [key, JSON.stringify(data), expiresAt]
      );
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Fetch GitHub activity for a swarm
   */
  async getActivity(swarmId: string, owner: string, repo: string, limit: number = 50): Promise<GitHubActivity[]> {
    const cacheKey = `activity:${swarmId}:${owner}:${repo}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const activities: GitHubActivity[] = [];

      try {
        // Fetch recent commits
        const commits = await this.octokit.repos.listCommits({
          owner,
          repo,
          per_page: 20,
        });

        for (const commit of commits.data) {
          activities.push({
            id: commit.sha,
            swarm_id: swarmId,
            event_type: 'commit',
            repository: `${owner}/${repo}`,
            actor: commit.commit.author?.name || 'Unknown',
            title: commit.commit.message.split('\n')[0],
            url: commit.html_url,
            timestamp: new Date(commit.commit.author?.date || Date.now()),
            metadata: {
              sha: commit.sha,
              message: commit.commit.message,
            },
          });
        }

        // Fetch recent pull requests
        const prs = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'all',
          sort: 'updated',
          per_page: 15,
        });

        for (const pr of prs.data) {
          activities.push({
            id: `pr-${pr.id}`,
            swarm_id: swarmId,
            event_type: 'pull_request',
            action: pr.state,
            repository: `${owner}/${repo}`,
            actor: pr.user?.login || 'Unknown',
            title: pr.title,
            url: pr.html_url,
            timestamp: new Date(pr.updated_at),
            metadata: {
              number: pr.number,
              state: pr.state,
              merged: pr.merged_at !== null,
            },
          });
        }

        // Fetch recent issues
        const issues = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'all',
          sort: 'updated',
          per_page: 15,
        });

        for (const issue of issues.data) {
          // Skip pull requests (they show up in issues API)
          if (issue.pull_request) continue;

          activities.push({
            id: `issue-${issue.id}`,
            swarm_id: swarmId,
            event_type: 'issue',
            action: issue.state,
            repository: `${owner}/${repo}`,
            actor: issue.user?.login || 'Unknown',
            title: issue.title,
            url: issue.html_url,
            timestamp: new Date(issue.updated_at),
            metadata: {
              number: issue.number,
              state: issue.state,
              labels: issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
            },
          });
        }

        // Sort by timestamp and limit
        return activities
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
      } catch (error) {
        console.error('Failed to fetch GitHub activity:', error);
        throw error;
      }
    });
  }

  /**
   * Fetch GitHub metrics for a swarm
   */
  async getMetrics(swarmId: string, owner: string, repo: string): Promise<GitHubMetrics> {
    const cacheKey = `metrics:${swarmId}:${owner}:${repo}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      try {
        // Fetch repository details
        const repoData = await this.octokit.repos.get({ owner, repo });

        // Fetch open/closed PRs
        const openPrs = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: 1,
        });

        const closedPrs = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'closed',
          per_page: 1,
        });

        // Fetch open/closed issues
        const openIssues = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'open',
          per_page: 1,
        });

        const closedIssues = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'closed',
          per_page: 1,
        });

        // Fetch recent commits
        const commits = await this.octokit.repos.listCommits({
          owner,
          repo,
          per_page: 1,
        });

        // Fetch check runs for latest commit
        let failingChecks = 0;
        let passingChecks = 0;

        if (commits.data.length > 0) {
          try {
            const checkRuns = await this.octokit.checks.listForRef({
              owner,
              repo,
              ref: commits.data[0].sha,
            });

            for (const check of checkRuns.data.check_runs) {
              if (check.conclusion === 'success') {
                passingChecks++;
              } else if (check.conclusion === 'failure') {
                failingChecks++;
              }
            }
          } catch (error) {
            // Check runs might not be available
            console.warn('Could not fetch check runs:', error);
          }
        }

        return {
          swarm_id: swarmId,
          repository: `${owner}/${repo}`,
          commits_count: repoData.data.size, // Approximation
          open_prs_count: openPrs.data.length > 0 ? parseInt(openPrs.headers['x-total-count'] || '0') : 0,
          closed_prs_count: closedPrs.data.length > 0 ? parseInt(closedPrs.headers['x-total-count'] || '0') : 0,
          open_issues_count: repoData.data.open_issues_count,
          closed_issues_count: closedIssues.data.length > 0 ? parseInt(closedIssues.headers['x-total-count'] || '0') : 0,
          failing_checks_count: failingChecks,
          passing_checks_count: passingChecks,
          last_commit_date: commits.data.length > 0 ? new Date(commits.data[0].commit.author?.date || Date.now()) : undefined,
          last_updated: new Date(),
        };
      } catch (error) {
        console.error('Failed to fetch GitHub metrics:', error);
        throw error;
      }
    });
  }

  /**
   * Process webhook event
   */
  async processWebhook(eventType: string, payload: any): Promise<void> {
    try {
      const activity: Partial<GitHubActivity> = {
        repository: payload.repository?.full_name,
        actor: payload.sender?.login,
        timestamp: new Date(),
      };

      switch (eventType) {
        case 'push':
          // Invalidate commit cache
          await this.invalidateCache(`activity:*:${payload.repository.owner.login}:${payload.repository.name}`);
          break;

        case 'pull_request':
          activity.event_type = 'pull_request';
          activity.action = payload.action;
          activity.title = payload.pull_request?.title;
          activity.url = payload.pull_request?.html_url;
          // Invalidate PR cache
          await this.invalidateCache(`activity:*:${payload.repository.owner.login}:${payload.repository.name}`);
          await this.invalidateCache(`metrics:*:${payload.repository.owner.login}:${payload.repository.name}`);
          break;

        case 'issues':
          activity.event_type = 'issue';
          activity.action = payload.action;
          activity.title = payload.issue?.title;
          activity.url = payload.issue?.html_url;
          // Invalidate issues cache
          await this.invalidateCache(`activity:*:${payload.repository.owner.login}:${payload.repository.name}`);
          await this.invalidateCache(`metrics:*:${payload.repository.owner.login}:${payload.repository.name}`);
          break;

        case 'check_suite':
          activity.event_type = 'check_suite';
          activity.action = payload.action;
          // Invalidate metrics cache
          await this.invalidateCache(`metrics:*:${payload.repository.owner.login}:${payload.repository.name}`);
          break;
      }

      console.log(`Processed ${eventType} webhook for ${payload.repository?.full_name}`);
    } catch (error) {
      console.error('Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  private async invalidateCache(pattern: string): Promise<void> {
    try {
      // Convert glob pattern to SQL LIKE pattern
      const likePattern = pattern.replace(/\*/g, '%');
      await query(
        `DELETE FROM github_cache WHERE cache_key LIKE $1`,
        [likePattern]
      );
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Clear all expired cache entries
   */
  async clearExpiredCache(): Promise<void> {
    try {
      const result = await query(
        `DELETE FROM github_cache WHERE expires_at <= NOW()`
      );
      console.log(`Cleared ${result.rowCount} expired cache entries`);
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }
}

export const githubService = new GitHubService();
