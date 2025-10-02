"""
QiFlow Project Tracker Module

Tracks project completion, calculates metrics, and monitors GitHub repository
activity for real-time project insights.

Features:
    - Issue state tracking (open, in_progress, blocked, done)
    - Completion percentage calculation
    - Velocity tracking (issues closed per day)
    - Intervention flagging for blocked issues
    - GitHub API integration
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from configparser import ConfigParser

logger = logging.getLogger(__name__)


class ProjectTracker:
    """
    Tracks project metrics including completion percentage, velocity,
    and issues requiring human intervention.
    """

    def __init__(self, config: ConfigParser):
        """
        Initialize the project tracker.

        Args:
            config: ConfigParser instance with project settings
        """
        self.config = config
        self.github_repo = config.get('project_tracking', 'github_repo', fallback=None)
        self.github_token = os.environ.get('GITHUB_TOKEN') or config.get('project_tracking', 'github_token', fallback=None)
        self.flag_blocked_after_hours = config.getint('project_tracking', 'flag_blocked_after_hours', fallback=24)
        self.flag_failures_threshold = config.getint('project_tracking', 'flag_failures_threshold', fallback=3)
        self.flag_test_failure_rate = config.getfloat('project_tracking', 'flag_test_failure_rate', fallback=0.10)

        logger.info(f"Project tracker initialized for repo: {self.github_repo}")

    def get_completion_metrics(self) -> Dict[str, Any]:
        """
        Calculate project completion metrics.

        Returns:
            Dictionary containing completion percentage, issue counts, and forecasts
        """
        try:
            # In production, this would fetch from GitHub API or local database
            # For now, return mock data structure
            issues = self._get_issues()

            total_issues = len(issues)
            completed_issues = sum(1 for i in issues if i.get('status') == 'done')
            in_progress_issues = sum(1 for i in issues if i.get('status') == 'in_progress')
            ready_issues = sum(1 for i in issues if i.get('status') == 'ready')
            blocked_issues = sum(1 for i in issues if i.get('status') == 'blocked')

            completion_percentage = (completed_issues / total_issues * 100) if total_issues > 0 else 0

            # Calculate velocity trend (7-day rolling average)
            velocity_trend = self._calculate_velocity_trend()

            # Estimate completion date
            estimated_completion = self._estimate_completion_date(
                total_issues - completed_issues,
                velocity_trend.get('issues_per_day', 1)
            )

            return {
                'completion_percentage': round(completion_percentage, 2),
                'total_issues': total_issues,
                'completed_issues': completed_issues,
                'in_progress_issues': in_progress_issues,
                'ready_issues': ready_issues,
                'blocked_issues': blocked_issues,
                'velocity_trend': velocity_trend,
                'estimated_completion_date': estimated_completion,
                'confidence_level': 0.95 if velocity_trend.get('trend') == 'stable' else 0.75,
                'last_updated': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error calculating completion metrics: {e}")
            return self._get_default_metrics()

    def get_issues(self, status_filter: Optional[str] = None, flagged_only: bool = False,
                   limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """
        Get paginated list of issues with optional filtering.

        Args:
            status_filter: Filter by status (ready, in_progress, blocked, done)
            flagged_only: Only return flagged issues
            limit: Results per page (max: 100)
            offset: Pagination offset

        Returns:
            Dictionary containing issues list and pagination info
        """
        try:
            issues = self._get_issues()

            # Apply filters
            if status_filter:
                issues = [i for i in issues if i.get('status') == status_filter]

            if flagged_only:
                issues = [i for i in issues if i.get('flagged_for_intervention')]

            # Apply pagination
            total = len(issues)
            paginated_issues = issues[offset:offset + min(limit, 100)]

            flagged_count = sum(1 for i in issues if i.get('flagged_for_intervention'))

            return {
                'issues': paginated_issues,
                'total': total,
                'flagged_count': flagged_count,
                'pagination': {
                    'limit': limit,
                    'offset': offset,
                    'has_more': (offset + len(paginated_issues)) < total
                }
            }
        except Exception as e:
            logger.error(f"Error getting issues: {e}")
            return {
                'issues': [],
                'total': 0,
                'flagged_count': 0,
                'pagination': {'limit': limit, 'offset': offset, 'has_more': False}
            }

    def flag_issue_for_intervention(self, issue_number: int, reason: str,
                                   priority: str = 'medium') -> bool:
        """
        Flag an issue as requiring human intervention.

        Args:
            issue_number: GitHub issue number
            reason: Reason for flagging
            priority: Priority level (low, medium, high, critical)

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Flagging issue #{issue_number} for intervention: {reason} (priority: {priority})")
            # In production, this would update the database or GitHub labels
            return True
        except Exception as e:
            logger.error(f"Error flagging issue #{issue_number}: {e}")
            return False

    def _get_issues(self) -> List[Dict[str, Any]]:
        """
        Fetch issues from GitHub API or local cache.

        Returns:
            List of issue dictionaries
        """
        # Mock data for now - in production this would call GitHub API
        return [
            {
                'number': 127,
                'title': 'Merge conflict in auth module',
                'status': 'blocked',
                'priority': 'high',
                'flagged_for_intervention': True,
                'flag_priority': 'critical',
                'flag_reason': 'Unable to resolve conflict',
                'blocked_duration_hours': 48,
                'assigned_agent': 'Agent-2',
                'github_url': f'https://github.com/{self.github_repo}/issues/127' if self.github_repo else '',
                'created_at': (datetime.utcnow() - timedelta(days=5)).isoformat(),
                'updated_at': (datetime.utcnow() - timedelta(hours=2)).isoformat()
            },
            {
                'number': 126,
                'title': 'Implement OAuth integration',
                'status': 'in_progress',
                'priority': 'medium',
                'flagged_for_intervention': False,
                'assigned_agent': 'Agent-1',
                'github_url': f'https://github.com/{self.github_repo}/issues/126' if self.github_repo else '',
                'created_at': (datetime.utcnow() - timedelta(days=3)).isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
        ]

    def _calculate_velocity_trend(self) -> Dict[str, Any]:
        """
        Calculate velocity trend using 7-day rolling average.

        Returns:
            Dictionary with velocity metrics
        """
        # Mock data - in production would query historical completion data
        last_7_days = [5, 8, 7, 6, 4, 9, 7]
        avg_per_day = sum(last_7_days) / len(last_7_days)

        # Simple trend detection
        first_half = sum(last_7_days[:3]) / 3
        second_half = sum(last_7_days[4:]) / 3
        trend_percentage = ((second_half - first_half) / first_half * 100) if first_half > 0 else 0

        if trend_percentage > 10:
            trend = 'increasing'
        elif trend_percentage < -10:
            trend = 'decreasing'
        else:
            trend = 'stable'

        return {
            'issues_per_day': round(avg_per_day, 2),
            'last_7_days': last_7_days,
            'trend': trend,
            'trend_percentage': round(trend_percentage, 2)
        }

    def _estimate_completion_date(self, remaining_issues: int, velocity_per_day: float) -> Optional[str]:
        """
        Estimate project completion date based on velocity.

        Args:
            remaining_issues: Number of issues remaining
            velocity_per_day: Average issues completed per day

        Returns:
            Estimated completion date in ISO format or None
        """
        if velocity_per_day <= 0:
            return None

        days_to_completion = remaining_issues / velocity_per_day
        completion_date = datetime.utcnow() + timedelta(days=days_to_completion)

        return completion_date.strftime('%Y-%m-%d')

    def _get_default_metrics(self) -> Dict[str, Any]:
        """Return default metrics structure when errors occur."""
        return {
            'completion_percentage': 0,
            'total_issues': 0,
            'completed_issues': 0,
            'in_progress_issues': 0,
            'ready_issues': 0,
            'blocked_issues': 0,
            'velocity_trend': {
                'issues_per_day': 0,
                'last_7_days': [],
                'trend': 'stable',
                'trend_percentage': 0
            },
            'estimated_completion_date': None,
            'confidence_level': 0,
            'last_updated': datetime.utcnow().isoformat()
        }
