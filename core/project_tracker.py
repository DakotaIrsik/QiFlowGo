"""
QiFlow Project Tracker Module

Tracks project completion metrics, velocity trends, and forecasts
completion dates based on GitHub issue data.
"""

import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from configparser import ConfigParser

logger = logging.getLogger(__name__)


class ProjectTracker:
    """
    Tracks project completion and generates velocity-based forecasts.
    """

    def __init__(self, config: ConfigParser):
        """
        Initialize the project tracker.

        Args:
            config: ConfigParser instance with project tracking settings
        """
        self.config = config
        self.github_repo = config.get('project_tracking', 'github_repo', fallback=None)
        self.github_token = config.get('project_tracking', 'github_token', fallback=None)
        self.flag_blocked_hours = config.getint('project_tracking', 'flag_blocked_after_hours', fallback=24)
        self.flag_failures_threshold = config.getint('project_tracking', 'flag_failures_threshold', fallback=3)

        # Cache for issue data
        self._issues_cache: Optional[List[Dict[str, Any]]] = None
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = 300  # 5 minutes

    def _get_github_headers(self) -> Dict[str, str]:
        """Get headers for GitHub API requests."""
        headers = {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
        if self.github_token:
            headers['Authorization'] = f'Bearer {self.github_token}'
        return headers

    def _fetch_github_issues(self) -> List[Dict[str, Any]]:
        """
        Fetch issues from GitHub API.

        Returns:
            List of issue dictionaries
        """
        if not self.github_repo:
            logger.warning("GitHub repository not configured")
            return []

        # Check cache
        if self._issues_cache and self._cache_time:
            if datetime.utcnow() - self._cache_time < timedelta(seconds=self._cache_ttl):
                logger.debug("Using cached issue data")
                return self._issues_cache

        try:
            url = f'https://api.github.com/repos/{self.github_repo}/issues'
            params = {
                'state': 'all',
                'per_page': 100,
                'sort': 'updated',
                'direction': 'desc'
            }

            response = requests.get(
                url,
                headers=self._get_github_headers(),
                params=params,
                timeout=10
            )

            if response.status_code == 200:
                issues = response.json()
                # Filter out pull requests
                issues = [issue for issue in issues if 'pull_request' not in issue]

                # Update cache
                self._issues_cache = issues
                self._cache_time = datetime.utcnow()

                logger.info(f"Fetched {len(issues)} issues from GitHub")
                return issues
            else:
                logger.error(f"GitHub API error: {response.status_code} - {response.text}")
                return []

        except Exception as e:
            logger.error(f"Error fetching GitHub issues: {e}")
            return []

    def _calculate_issue_metrics(self, issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate issue metrics from GitHub data.

        Args:
            issues: List of GitHub issue dictionaries

        Returns:
            Dictionary with issue metrics
        """
        total_issues = len(issues)
        completed_issues = sum(1 for issue in issues if issue.get('state') == 'closed')
        open_issues = sum(1 for issue in issues if issue.get('state') == 'open')

        # Categorize open issues by labels
        in_progress = sum(1 for issue in issues
                         if issue.get('state') == 'open' and
                         any(label['name'].lower() in ['in progress', 'in-progress', 'wip']
                             for label in issue.get('labels', [])))

        blocked = sum(1 for issue in issues
                     if issue.get('state') == 'open' and
                     any(label['name'].lower() in ['blocked', 'waiting', 'on-hold']
                         for label in issue.get('labels', [])))

        ready = open_issues - in_progress - blocked

        # Calculate completion percentage
        completion_percentage = (completed_issues / total_issues * 100) if total_issues > 0 else 0

        return {
            'total_issues': total_issues,
            'completed_issues': completed_issues,
            'in_progress_issues': in_progress,
            'ready_issues': ready,
            'blocked_issues': blocked,
            'completion_percentage': round(completion_percentage, 2)
        }

    def _flag_issues_for_intervention(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identify issues that require human intervention.

        Args:
            issues: List of GitHub issue dictionaries

        Returns:
            List of flagged issues with intervention details
        """
        flagged = []
        now = datetime.utcnow()

        for issue in issues:
            if issue.get('state') != 'open':
                continue

            flag_reasons = []
            priority = 'low'

            # Check for blocked label
            labels = [label['name'].lower() for label in issue.get('labels', [])]
            if any(label in ['blocked', 'waiting', 'on-hold'] for label in labels):
                # Check how long it's been blocked
                updated_at = datetime.strptime(issue['updated_at'], '%Y-%m-%dT%H:%M:%SZ')
                hours_blocked = (now - updated_at).total_seconds() / 3600

                if hours_blocked > self.flag_blocked_hours:
                    flag_reasons.append(f"Blocked for {int(hours_blocked)} hours")
                    priority = 'high'

            # Check for multiple failed attempts (based on comments count as proxy)
            if issue.get('comments', 0) > self.flag_failures_threshold * 2:
                flag_reasons.append(f"High comment count ({issue['comments']})")
                priority = 'medium' if priority == 'low' else priority

            # Check for critical/urgent labels
            if any(label in ['critical', 'urgent', 'p0', 'p1'] for label in labels):
                flag_reasons.append("High priority issue")
                priority = 'critical'

            if flag_reasons:
                flagged.append({
                    'number': issue['number'],
                    'title': issue['title'],
                    'status': 'blocked' if 'blocked' in labels else 'open',
                    'priority': priority,
                    'flagged_for_intervention': True,
                    'flag_priority': priority,
                    'flag_reason': '; '.join(flag_reasons),
                    'github_url': issue['html_url'],
                    'created_at': issue['created_at'],
                    'updated_at': issue['updated_at']
                })

        return flagged

    def _calculate_velocity(self, issues: List[Dict[str, Any]], days: int = 7) -> Dict[str, Any]:
        """
        Calculate velocity trend from closed issues.

        Args:
            issues: List of GitHub issue dictionaries
            days: Number of days to analyze (default: 7)

        Returns:
            Velocity metrics dictionary
        """
        now = datetime.utcnow()
        cutoff_date = now - timedelta(days=days)

        # Get recently closed issues
        closed_issues = [
            issue for issue in issues
            if issue.get('state') == 'closed' and issue.get('closed_at')
        ]

        # Count issues closed in the time window
        recent_closed = []
        for issue in closed_issues:
            try:
                closed_at = datetime.strptime(issue['closed_at'], '%Y-%m-%dT%H:%M:%SZ')
                if closed_at >= cutoff_date:
                    recent_closed.append(closed_at)
            except (ValueError, KeyError):
                continue

        # Calculate daily closure counts
        daily_counts = [0] * days
        for closed_at in recent_closed:
            day_index = (now - closed_at).days
            if 0 <= day_index < days:
                daily_counts[days - 1 - day_index] += 1

        issues_per_day = len(recent_closed) / days if days > 0 else 0

        # Simple trend detection
        if len(daily_counts) >= 3:
            first_half = sum(daily_counts[:len(daily_counts)//2])
            second_half = sum(daily_counts[len(daily_counts)//2:])

            if second_half > first_half * 1.2:
                trend = 'increasing'
            elif second_half < first_half * 0.8:
                trend = 'decreasing'
            else:
                trend = 'stable'
        else:
            trend = 'stable'

        return {
            'issues_per_day': round(issues_per_day, 2),
            'last_7_days': daily_counts,
            'trend': trend,
            'total_closed_in_period': len(recent_closed)
        }

    def _calculate_forecast(self, metrics: Dict[str, Any], velocity: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate project completion forecast.

        Args:
            metrics: Issue metrics dictionary
            velocity: Velocity metrics dictionary

        Returns:
            Forecast dictionary
        """
        remaining_issues = metrics['total_issues'] - metrics['completed_issues']
        issues_per_day = velocity['issues_per_day']

        if issues_per_day <= 0:
            return {
                'estimated_completion_date': None,
                'days_remaining': None,
                'confidence_level': 0.0,
                'confidence_label': 'Unknown'
            }

        days_remaining = remaining_issues / issues_per_day
        estimated_date = datetime.utcnow() + timedelta(days=days_remaining)

        # Simple confidence calculation based on trend
        if velocity['trend'] == 'increasing':
            confidence = 0.85
        elif velocity['trend'] == 'stable':
            confidence = 0.75
        else:  # decreasing
            confidence = 0.50

        confidence_label = 'High' if confidence > 0.80 else 'Medium' if confidence > 0.60 else 'Low'

        return {
            'estimated_completion_date': estimated_date.strftime('%Y-%m-%d'),
            'days_remaining': int(days_remaining),
            'confidence_level': confidence,
            'confidence_label': confidence_label
        }

    def get_completion_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive project completion metrics.

        Returns:
            Dictionary with completion metrics, velocity, and forecast
        """
        issues = self._fetch_github_issues()

        if not issues:
            return {
                'completion_percentage': 0,
                'total_issues': 0,
                'completed_issues': 0,
                'in_progress_issues': 0,
                'ready_issues': 0,
                'blocked_issues': 0,
                'velocity_trend': {},
                'estimated_completion_date': None,
                'confidence_level': 0.0,
                'flagged_issues': [],
                'last_updated': datetime.utcnow().isoformat()
            }

        # Calculate metrics
        metrics = self._calculate_issue_metrics(issues)
        velocity = self._calculate_velocity(issues)
        forecast = self._calculate_forecast(metrics, velocity)
        flagged = self._flag_issues_for_intervention(issues)

        return {
            **metrics,
            'velocity_trend': velocity,
            'estimated_completion_date': forecast['estimated_completion_date'],
            'days_remaining': forecast.get('days_remaining'),
            'confidence_level': forecast['confidence_level'],
            'confidence_label': forecast['confidence_label'],
            'flagged_issues': flagged,
            'last_updated': datetime.utcnow().isoformat()
        }

    def get_issues(self, status: Optional[str] = None, flagged: bool = False,
                   limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """
        Get paginated list of issues with filtering.

        Args:
            status: Filter by status (open, closed)
            flagged: Only return flagged issues
            limit: Number of results per page
            offset: Pagination offset

        Returns:
            Dictionary with paginated issues
        """
        issues = self._fetch_github_issues()

        # Apply filters
        if status:
            issues = [issue for issue in issues if issue.get('state') == status]

        if flagged:
            flagged_issues = self._flag_issues_for_intervention(issues)
            flagged_numbers = {issue['number'] for issue in flagged_issues}
            issues = [issue for issue in issues if issue['number'] in flagged_numbers]

        # Paginate
        total = len(issues)
        paginated = issues[offset:offset + limit]

        # Format for response
        formatted_issues = []
        for issue in paginated:
            labels = [label['name'] for label in issue.get('labels', [])]
            formatted_issues.append({
                'number': issue['number'],
                'title': issue['title'],
                'status': issue['state'],
                'labels': labels,
                'created_at': issue['created_at'],
                'updated_at': issue['updated_at'],
                'github_url': issue['html_url']
            })

        return {
            'issues': formatted_issues,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_more': offset + limit < total
        }
