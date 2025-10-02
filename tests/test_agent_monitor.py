"""
Tests for the AgentMonitor module
"""

import pytest
from configparser import ConfigParser
from pathlib import Path
from core.agent_monitor import AgentMonitor


@pytest.fixture
def config():
    """Create a test configuration."""
    config = ConfigParser()
    config.add_section('logging')
    config.set('logging', 'log_dir', 'logs')
    config.set('logging', 'max_log_lines', '1000')
    return config


@pytest.fixture
def monitor(config):
    """Create an AgentMonitor instance."""
    return AgentMonitor(config)


def test_initialization(monitor):
    """Test AgentMonitor initializes correctly."""
    assert monitor.log_dir == Path('logs')
    assert monitor.max_log_lines == 1000


def test_get_agent_activity(monitor):
    """Test getting agent activity."""
    activity = monitor.get_agent_activity()

    assert 'agents' in activity
    assert 'total_agents' in activity
    assert 'active_agents' in activity
    assert 'idle_agents' in activity
    assert 'failed_agents' in activity
    assert 'last_updated' in activity

    # Verify agents structure
    for agent in activity['agents']:
        assert 'name' in agent
        assert 'status' in agent
        assert 'last_activity' in agent


def test_get_system_logs_no_filter(monitor):
    """Test getting system logs without filter."""
    logs = monitor.get_system_logs()

    assert 'logs' in logs
    assert 'total_lines' in logs
    assert 'level_filter' in logs
    assert 'timestamp' in logs


def test_get_system_logs_with_level_filter(monitor):
    """Test getting system logs with level filter."""
    logs = monitor.get_system_logs(level='error')

    assert logs['level_filter'] == 'error'


def test_get_system_logs_with_lines_limit(monitor):
    """Test getting system logs with lines limit."""
    logs = monitor.get_system_logs(lines=50)

    assert len(logs['logs']) <= 50


def test_get_system_logs_respects_max_limit(monitor):
    """Test that system logs respect maximum line limit."""
    # Try to request more than max_log_lines
    logs = monitor.get_system_logs(lines=5000)

    # Should be capped at max_log_lines (1000)
    assert len(logs['logs']) <= 1000


def test_get_agent_details(monitor):
    """Test getting detailed agent information."""
    agent = monitor.get_agent_details('Agent-1')

    if agent:
        assert 'name' in agent
        assert 'status' in agent
        assert agent['name'] == 'Agent-1'


def test_parse_log_line_valid(monitor):
    """Test parsing a valid log line."""
    log_line = "2025-10-02 10:30:00 - core.heartbeat - INFO - Heartbeat sent successfully"
    parsed = monitor._parse_log_line(log_line)

    if parsed:
        assert 'timestamp' in parsed
        assert 'logger' in parsed
        assert 'level' in parsed
        assert 'message' in parsed


def test_parse_log_line_invalid(monitor):
    """Test parsing an invalid log line."""
    log_line = "invalid log line"
    parsed = monitor._parse_log_line(log_line)

    # Should return None for invalid lines
    assert parsed is None or isinstance(parsed, dict)


def test_get_running_agents(monitor):
    """Test getting list of running agents."""
    agents = monitor._get_running_agents()

    assert isinstance(agents, list)

    for agent in agents:
        assert 'name' in agent
        assert 'status' in agent
        assert agent['status'] in ['active', 'idle', 'blocked', 'failed']


def test_get_process_info(monitor):
    """Test getting process information."""
    import os

    # Get info for current process
    info = monitor._get_process_info(os.getpid())

    if info:
        assert 'cpu_percent' in info
        assert 'memory_mb' in info
        assert 'status' in info


def test_get_agent_recent_tasks(monitor):
    """Test getting agent recent tasks."""
    tasks = monitor._get_agent_recent_tasks('Agent-1')

    assert isinstance(tasks, list)

    for task in tasks:
        assert 'issue_number' in task
        assert 'title' in task
        assert 'completed_at' in task
