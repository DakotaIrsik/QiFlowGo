"""
Tests for the ProjectTracker module
"""

import pytest
from configparser import ConfigParser
from core.project_tracker import ProjectTracker


@pytest.fixture
def config():
    """Create a test configuration."""
    config = ConfigParser()
    config.add_section('project_tracking')
    config.set('project_tracking', 'github_repo', 'owner/test-repo')
    config.set('project_tracking', 'flag_blocked_after_hours', '24')
    config.set('project_tracking', 'flag_failures_threshold', '3')
    config.set('project_tracking', 'flag_test_failure_rate', '0.10')
    return config


@pytest.fixture
def tracker(config):
    """Create a ProjectTracker instance."""
    return ProjectTracker(config)


def test_initialization(tracker):
    """Test ProjectTracker initializes correctly."""
    assert tracker.github_repo == 'owner/test-repo'
    assert tracker.flag_blocked_after_hours == 24
    assert tracker.flag_failures_threshold == 3
    assert tracker.flag_test_failure_rate == 0.10


def test_get_completion_metrics(tracker):
    """Test getting completion metrics."""
    metrics = tracker.get_completion_metrics()

    assert 'completion_percentage' in metrics
    assert 'total_issues' in metrics
    assert 'completed_issues' in metrics
    assert 'in_progress_issues' in metrics
    assert 'blocked_issues' in metrics
    assert 'velocity_trend' in metrics
    assert 'estimated_completion_date' in metrics
    assert 'confidence_level' in metrics

    # Verify velocity trend structure
    velocity = metrics['velocity_trend']
    assert 'issues_per_day' in velocity
    assert 'last_7_days' in velocity
    assert 'trend' in velocity
    assert 'trend_percentage' in velocity


def test_get_issues_no_filters(tracker):
    """Test getting issues without filters."""
    result = tracker.get_issues()

    assert 'issues' in result
    assert 'total' in result
    assert 'flagged_count' in result
    assert 'pagination' in result

    pagination = result['pagination']
    assert pagination['limit'] == 20
    assert pagination['offset'] == 0
    assert 'has_more' in pagination


def test_get_issues_with_status_filter(tracker):
    """Test getting issues with status filter."""
    result = tracker.get_issues(status_filter='blocked')

    assert 'issues' in result
    # All returned issues should have blocked status
    for issue in result['issues']:
        assert issue['status'] == 'blocked'


def test_get_issues_flagged_only(tracker):
    """Test getting only flagged issues."""
    result = tracker.get_issues(flagged_only=True)

    assert 'issues' in result
    # All returned issues should be flagged
    for issue in result['issues']:
        assert issue['flagged_for_intervention'] is True


def test_get_issues_pagination(tracker):
    """Test issue pagination."""
    # Get first page
    page1 = tracker.get_issues(limit=1, offset=0)

    assert len(page1['issues']) <= 1
    assert page1['pagination']['limit'] == 1
    assert page1['pagination']['offset'] == 0

    # Get second page
    page2 = tracker.get_issues(limit=1, offset=1)

    assert page2['pagination']['offset'] == 1


def test_flag_issue_for_intervention(tracker):
    """Test flagging an issue for intervention."""
    result = tracker.flag_issue_for_intervention(
        issue_number=127,
        reason='Test reason',
        priority='high'
    )

    assert result is True


def test_velocity_calculation(tracker):
    """Test velocity calculation."""
    velocity = tracker._calculate_velocity_trend()

    assert 'issues_per_day' in velocity
    assert 'last_7_days' in velocity
    assert len(velocity['last_7_days']) == 7
    assert 'trend' in velocity
    assert velocity['trend'] in ['increasing', 'decreasing', 'stable']


def test_completion_date_estimation(tracker):
    """Test completion date estimation."""
    # With positive velocity
    date = tracker._estimate_completion_date(remaining_issues=10, velocity_per_day=2.0)
    assert date is not None

    # With zero velocity
    date = tracker._estimate_completion_date(remaining_issues=10, velocity_per_day=0)
    assert date is None

    # With negative velocity
    date = tracker._estimate_completion_date(remaining_issues=10, velocity_per_day=-1)
    assert date is None
