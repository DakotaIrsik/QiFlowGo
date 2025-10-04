import axios from 'axios';
import { ProjectCompletionService } from './projectCompletionService';
import { InterventionFlagModel } from '../models/InterventionFlagModel';
import { VelocityService } from './velocityService';

jest.mock('axios');
jest.mock('../models/InterventionFlagModel');
jest.mock('./velocityService');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInterventionFlagModel = InterventionFlagModel as jest.Mocked<typeof InterventionFlagModel>;
const mockedVelocityService = VelocityService as jest.Mocked<typeof VelocityService>;

describe('ProjectCompletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectCompletion', () => {
    const mockGitHubIssues = [
      {
        number: 1,
        title: 'Test Issue 1',
        state: 'closed',
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        closed_at: '2025-01-02T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/1',
      },
      {
        number: 2,
        title: 'Test Issue 2',
        state: 'open',
        labels: [{ name: 'in-progress', color: 'yellow' }],
        created_at: '2025-01-03T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/2',
      },
      {
        number: 3,
        title: 'Test Issue 3',
        state: 'open',
        labels: [{ name: 'blocked', color: 'red' }],
        created_at: '2025-01-04T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/3',
      },
      {
        number: 4,
        title: 'Test Issue 4',
        state: 'open',
        labels: [],
        created_at: '2025-01-05T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/4',
      },
    ];

    it('should fetch and categorize GitHub issues correctly', async () => {
      // Mock GitHub API responses
      mockedAxios.get.mockResolvedValueOnce({
        data: [mockGitHubIssues[1], mockGitHubIssues[2], mockGitHubIssues[3]],
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: [mockGitHubIssues[0]],
      });

      // Mock intervention flags
      mockedInterventionFlagModel.find.mockResolvedValue([
        {
          id: 1,
          swarm_id: 'test-swarm',
          issue_number: 3,
          github_url: 'https://github.com/owner/repo/issues/3',
          priority: 'critical',
          reason: 'Blocked by merge conflict',
          trigger_type: 'merge_conflict',
          agent_message: 'Cannot resolve merge conflict',
          blocked_duration_hours: 48,
          flagged_at: new Date(),
        } as any,
      ]);

      // Mock velocity data
      mockedVelocityService.calculateVelocity.mockResolvedValue({
        issues_per_day: 2.5,
        last_n_days: [3, 2, 4, 1, 3, 2, 2],
        period_days: 7,
        period_start: '2025-01-01',
        period_end: '2025-01-07',
      });

      mockedVelocityService.detectTrend.mockReturnValue({
        trend: 'stable',
        trend_percentage: 5,
        slope: 0.1,
      });

      mockedVelocityService.generateForecast.mockResolvedValue({
        estimated_completion_date: '2025-02-01',
        days_remaining: 10,
        confidence_level: 0.85,
        confidence_label: 'High',
        based_on_velocity: 2.5,
        remaining_issues: 3,
      });

      const result = await ProjectCompletionService.getProjectCompletion(
        'test-swarm',
        'owner',
        'repo',
        'test-token'
      );

      // Verify the results
      expect(result.total_issues).toBe(4);
      expect(result.completed_issues).toBe(1);
      expect(result.in_progress_issues).toBe(1);
      expect(result.blocked_issues).toBe(1);
      expect(result.ready_issues).toBe(1);
      expect(result.completion_percentage).toBe(25); // 1/4 = 25%

      // Verify intervention flags
      expect(result.issues_requiring_human_intervention).toHaveLength(1);
      expect(result.issues_requiring_human_intervention[0]).toMatchObject({
        issue_number: 3,
        title: 'Test Issue 3',
        priority: 'critical',
        blocked_duration_hours: 48,
      });

      // Verify velocity trend
      expect(result.velocity_trend.issues_per_day).toBe(2.5);
      expect(result.velocity_trend.trend).toBe('stable');

      // Verify forecast
      expect(result.estimated_completion_date).toBe('2025-02-01');
      expect(result.confidence_level).toBe(0.85);
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        ProjectCompletionService.getProjectCompletion('test-swarm', 'owner', 'repo')
      ).rejects.toThrow('Failed to fetch GitHub issues');
    });

    it('should calculate 100% completion when all issues are closed', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          { ...mockGitHubIssues[0], number: 1 },
          { ...mockGitHubIssues[0], number: 2 },
        ],
      });

      mockedInterventionFlagModel.find.mockResolvedValue([]);

      mockedVelocityService.calculateVelocity.mockResolvedValue({
        issues_per_day: 3.0,
        last_n_days: [3, 3, 3, 3, 3, 3, 3],
        period_days: 7,
        period_start: '2025-01-01',
        period_end: '2025-01-07',
      });

      mockedVelocityService.detectTrend.mockReturnValue({
        trend: 'stable',
        trend_percentage: 0,
        slope: 0,
      });

      mockedVelocityService.generateForecast.mockResolvedValue({
        estimated_completion_date: new Date().toISOString().split('T')[0],
        days_remaining: 0,
        confidence_level: 1.0,
        confidence_label: 'High',
        based_on_velocity: 3.0,
        remaining_issues: 0,
      });

      const result = await ProjectCompletionService.getProjectCompletion(
        'test-swarm',
        'owner',
        'repo'
      );

      expect(result.completion_percentage).toBe(100);
      expect(result.completed_issues).toBe(2);
      expect(result.total_issues).toBe(2);
    });

    it('should filter out pull requests from issue count', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          mockGitHubIssues[1],
          { ...mockGitHubIssues[1], pull_request: { url: 'test' } }, // This should be filtered
        ],
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: [mockGitHubIssues[0]],
      });

      mockedInterventionFlagModel.find.mockResolvedValue([]);

      mockedVelocityService.calculateVelocity.mockResolvedValue({
        issues_per_day: 1.0,
        last_n_days: [1, 1, 1, 1, 1, 1, 1],
        period_days: 7,
        period_start: '2025-01-01',
        period_end: '2025-01-07',
      });

      mockedVelocityService.detectTrend.mockReturnValue({
        trend: 'stable',
        trend_percentage: 0,
        slope: 0,
      });

      mockedVelocityService.generateForecast.mockResolvedValue({
        estimated_completion_date: '2025-01-10',
        days_remaining: 1,
        confidence_level: 0.9,
        confidence_label: 'High',
        based_on_velocity: 1.0,
        remaining_issues: 1,
      });

      const result = await ProjectCompletionService.getProjectCompletion(
        'test-swarm',
        'owner',
        'repo'
      );

      // Should only count 2 issues (not the PR)
      expect(result.total_issues).toBe(2);
    });
  });
});
