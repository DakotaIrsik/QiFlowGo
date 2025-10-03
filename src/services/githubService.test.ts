import { githubService } from './githubService';
import { query } from '../database/db';

// Mock the database
jest.mock('../database/db');
const mockQuery = query as jest.MockedFunction<typeof query>;

// Mock Octokit
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      rateLimit: {
        get: jest.fn().mockResolvedValue({
          data: {
            rate: {
              limit: 5000,
              remaining: 4999,
              reset: Math.floor(Date.now() / 1000) + 3600,
              used: 1,
            },
          },
        }),
      },
      repos: {
        listCommits: jest.fn().mockResolvedValue({
          data: [
            {
              sha: 'abc123',
              commit: {
                author: {
                  name: 'Test User',
                  date: new Date().toISOString(),
                },
                message: 'Test commit',
              },
              html_url: 'https://github.com/test/repo/commit/abc123',
            },
          ],
        }),
        get: jest.fn().mockResolvedValue({
          data: {
            size: 1000,
            open_issues_count: 5,
          },
        }),
      },
      pulls: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 1,
              number: 10,
              title: 'Test PR',
              state: 'open',
              user: { login: 'testuser' },
              html_url: 'https://github.com/test/repo/pull/10',
              updated_at: new Date().toISOString(),
              merged_at: null,
            },
          ],
          headers: {
            'x-total-count': '3',
          },
        }),
      },
      issues: {
        listForRepo: jest.fn().mockResolvedValue({
          data: [
            {
              id: 2,
              number: 5,
              title: 'Test Issue',
              state: 'open',
              user: { login: 'testuser' },
              html_url: 'https://github.com/test/repo/issues/5',
              updated_at: new Date().toISOString(),
              labels: [{ name: 'bug' }],
              pull_request: undefined,
            },
          ],
          headers: {
            'x-total-count': '10',
          },
        }),
      },
      checks: {
        listForRef: jest.fn().mockResolvedValue({
          data: {
            check_runs: [
              { conclusion: 'success' },
              { conclusion: 'success' },
              { conclusion: 'failure' },
            ],
          },
        }),
      },
    })),
  };
});

describe('GitHubService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
  });

  describe('getRateLimit', () => {
    it('should fetch and return rate limit information', async () => {
      const rateLimit = await githubService.getRateLimit();

      expect(rateLimit).toMatchObject({
        limit: 5000,
        remaining: 4999,
        used: 1,
      });
      expect(rateLimit.reset).toBeInstanceOf(Date);
    });
  });

  describe('shouldMakeApiCall', () => {
    it('should return true when rate limit is above threshold', async () => {
      await githubService.getRateLimit();
      const shouldCall = await githubService.shouldMakeApiCall();
      expect(shouldCall).toBe(true);
    });
  });

  describe('getActivity', () => {
    it('should return cached activity when available', async () => {
      const cachedData = [
        {
          id: 'cached-1',
          swarm_id: 'swarm-1',
          event_type: 'commit',
          repository: 'test/repo',
          actor: 'Test User',
          timestamp: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: [{ data: cachedData }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const activity = await githubService.getActivity('swarm-1', 'test', 'repo');

      expect(activity).toEqual(cachedData);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT data FROM github_cache'),
        ['activity:swarm-1:test:repo']
      );
    });

    it('should fetch fresh activity when cache is empty', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const activity = await githubService.getActivity('swarm-1', 'test', 'repo');

      expect(activity).toBeDefined();
      expect(activity.length).toBeGreaterThan(0);
      expect(activity[0]).toMatchObject({
        swarm_id: 'swarm-1',
        repository: 'test/repo',
      });

      // Verify cache was written
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO github_cache'),
        expect.any(Array)
      );
    });

    it('should limit activity results to specified limit', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const activity = await githubService.getActivity('swarm-1', 'test', 'repo', 10);

      expect(activity.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getMetrics', () => {
    it('should return cached metrics when available', async () => {
      const cachedMetrics = {
        swarm_id: 'swarm-1',
        repository: 'test/repo',
        commits_count: 100,
        open_prs_count: 3,
        closed_prs_count: 10,
        open_issues_count: 5,
        closed_issues_count: 20,
        failing_checks_count: 1,
        passing_checks_count: 2,
        last_updated: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ data: cachedMetrics }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const metrics = await githubService.getMetrics('swarm-1', 'test', 'repo');

      expect(metrics).toEqual(cachedMetrics);
    });

    it('should fetch fresh metrics when cache is empty', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const metrics = await githubService.getMetrics('swarm-1', 'test', 'repo');

      expect(metrics).toMatchObject({
        swarm_id: 'swarm-1',
        repository: 'test/repo',
        commits_count: expect.any(Number),
        open_prs_count: expect.any(Number),
        open_issues_count: expect.any(Number),
        failing_checks_count: expect.any(Number),
        passing_checks_count: expect.any(Number),
      });
    });
  });

  describe('processWebhook', () => {
    it('should process push webhook and invalidate cache', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] });

      await githubService.processWebhook('push', {
        repository: {
          owner: { login: 'test' },
          name: 'repo',
          full_name: 'test/repo',
        },
        sender: { login: 'testuser' },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM github_cache'),
        expect.arrayContaining([expect.stringContaining('activity:%:test:repo')])
      );
    });

    it('should process pull_request webhook and invalidate cache', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] });

      await githubService.processWebhook('pull_request', {
        action: 'opened',
        repository: {
          owner: { login: 'test' },
          name: 'repo',
          full_name: 'test/repo',
        },
        sender: { login: 'testuser' },
        pull_request: {
          title: 'New PR',
          html_url: 'https://github.com/test/repo/pull/1',
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM github_cache'),
        expect.any(Array)
      );
    });

    it('should process issues webhook and invalidate cache', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] });

      await githubService.processWebhook('issues', {
        action: 'opened',
        repository: {
          owner: { login: 'test' },
          name: 'repo',
          full_name: 'test/repo',
        },
        sender: { login: 'testuser' },
        issue: {
          title: 'New Issue',
          html_url: 'https://github.com/test/repo/issues/1',
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM github_cache'),
        expect.any(Array)
      );
    });
  });

  describe('clearExpiredCache', () => {
    it('should delete expired cache entries', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 5, command: 'DELETE', oid: 0, fields: [] });

      await githubService.clearExpiredCache();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM github_cache WHERE expires_at <= NOW()')
      );
    });
  });
});
