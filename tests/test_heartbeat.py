"""
Unit tests for the HeartbeatAgent module.
"""

import json
import os
import tempfile
import time
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

import pytest
import requests
import responses

from core.heartbeat import HeartbeatAgent


@pytest.fixture
def temp_config():
    """Create a temporary configuration file."""
    config_content = """[heartbeat]
monitor_url = https://test-backend.com/api/v1/heartbeat
api_key = test-api-key-123
interval = 60
swarm_id = test-swarm-001

[project_tracking]
github_repo = testowner/testrepo
"""
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.ini') as f:
        f.write(config_content)
        config_path = f.name

    yield config_path

    # Cleanup
    if os.path.exists(config_path):
        os.unlink(config_path)


@pytest.fixture
def agent(temp_config):
    """Create a HeartbeatAgent instance with test configuration."""
    return HeartbeatAgent(config_path=temp_config)


class TestHeartbeatAgent:
    """Test cases for HeartbeatAgent class."""

    def test_initialization(self, agent):
        """Test that the agent initializes correctly."""
        assert agent.monitor_url == 'https://test-backend.com/api/v1/heartbeat'
        assert agent.api_key == 'test-api-key-123'
        assert agent.interval == 60
        assert agent.swarm_id == 'test-swarm-001'
        assert agent.github_repo == 'testowner/testrepo'
        assert agent.running is False

    def test_initialization_without_config(self):
        """Test initialization with missing config file."""
        agent = HeartbeatAgent(config_path='nonexistent.ini')
        assert agent.monitor_url is None
        assert agent.swarm_id is not None  # Should be auto-generated

    def test_collect_metrics(self, agent):
        """Test that metrics collection returns expected structure."""
        metrics = agent.collect_metrics()

        assert 'swarm_id' in metrics
        assert 'timestamp' in metrics
        assert 'system' in metrics
        assert 'agents' in metrics
        assert 'github' in metrics
        assert 'resources' in metrics
        assert 'project' in metrics

        # Verify swarm_id matches
        assert metrics['swarm_id'] == 'test-swarm-001'

    def test_collect_system_metrics(self, agent):
        """Test system metrics collection."""
        system_metrics = agent._collect_system_metrics()

        assert 'hostname' in system_metrics
        assert 'platform' in system_metrics
        assert 'python_version' in system_metrics
        assert system_metrics['platform'] == 'win32' or system_metrics['platform'] == 'linux'

    def test_collect_resource_metrics(self, agent):
        """Test resource metrics collection."""
        resource_metrics = agent._collect_resource_metrics()

        assert 'cpu_percent' in resource_metrics
        assert 'memory_total_gb' in resource_metrics
        assert 'memory_used_gb' in resource_metrics
        assert 'memory_percent' in resource_metrics
        assert 'disk_total_gb' in resource_metrics
        assert 'disk_used_gb' in resource_metrics
        assert 'disk_percent' in resource_metrics

        # Verify values are reasonable
        assert 0 <= resource_metrics['cpu_percent'] <= 100
        assert 0 <= resource_metrics['memory_percent'] <= 100
        assert 0 <= resource_metrics['disk_percent'] <= 100

    def test_collect_agent_metrics(self, agent):
        """Test agent metrics collection."""
        agent_metrics = agent._collect_agent_metrics()

        assert 'active_agents' in agent_metrics
        assert 'total_agents' in agent_metrics
        assert 'agents_status' in agent_metrics
        assert isinstance(agent_metrics['agents_status'], list)

    def test_collect_github_metrics_enabled(self, agent):
        """Test GitHub metrics when repository is configured."""
        github_metrics = agent._collect_github_metrics()

        assert github_metrics['enabled'] is True
        assert github_metrics['repository'] == 'testowner/testrepo'

    def test_collect_github_metrics_disabled(self):
        """Test GitHub metrics when no repository is configured."""
        agent = HeartbeatAgent(config_path='nonexistent.ini')
        github_metrics = agent._collect_github_metrics()

        assert github_metrics['enabled'] is False

    def test_collect_project_metrics(self, agent):
        """Test project metrics collection."""
        project_metrics = agent._collect_project_metrics()

        assert 'completion_percentage' in project_metrics
        assert 'total_issues' in project_metrics
        assert 'completed_issues' in project_metrics
        assert 'blocked_issues' in project_metrics
        assert 'issues_requiring_intervention' in project_metrics

    @responses.activate
    def test_send_heartbeat_success(self, agent):
        """Test successful heartbeat transmission."""
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'success': True},
            status=200
        )

        metrics = agent.collect_metrics()
        result = agent.send_heartbeat(metrics)

        assert result is True
        assert len(responses.calls) == 1
        assert responses.calls[0].request.headers['Authorization'] == 'Bearer test-api-key-123'

    @responses.activate
    def test_send_heartbeat_failure(self, agent):
        """Test heartbeat transmission failure."""
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'error': 'Invalid API key'},
            status=401
        )

        metrics = agent.collect_metrics()
        result = agent.send_heartbeat(metrics)

        assert result is False
        assert len(responses.calls) == agent.max_retries

    @responses.activate
    def test_send_heartbeat_retry_logic(self, agent):
        """Test that heartbeat retries on network errors."""
        # First two attempts fail with network error, third succeeds
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            body=requests.exceptions.RequestException('Network error')
        )
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            body=requests.exceptions.RequestException('Network error')
        )
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'success': True},
            status=200
        )

        metrics = agent.collect_metrics()
        result = agent.send_heartbeat(metrics)

        assert result is True
        assert len(responses.calls) == 3

    def test_send_heartbeat_without_url(self):
        """Test that send_heartbeat skips when monitor_url is not configured."""
        agent = HeartbeatAgent(config_path='nonexistent.ini')
        metrics = agent.collect_metrics()
        result = agent.send_heartbeat(metrics)

        assert result is False

    def test_log_metrics_locally(self, agent, tmp_path):
        """Test local metrics logging."""
        # Change working directory to temp path for this test
        original_cwd = os.getcwd()
        os.chdir(tmp_path)

        try:
            metrics = agent.collect_metrics()
            agent._log_metrics_locally(metrics)

            # Verify log file was created
            log_dir = tmp_path / 'logs'
            assert log_dir.exists()

            log_files = list(log_dir.glob('heartbeat_*.json'))
            assert len(log_files) == 1

            # Verify log content
            with open(log_files[0], 'r') as f:
                logged_metrics = json.loads(f.readline())
                assert logged_metrics['swarm_id'] == metrics['swarm_id']
        finally:
            os.chdir(original_cwd)

    def test_get_status(self, agent):
        """Test get_status method."""
        status = agent.get_status()

        assert 'running' in status
        assert 'swarm_id' in status
        assert 'monitor_url' in status
        assert 'interval' in status
        assert 'github_repo' in status

        assert status['running'] is False
        assert status['swarm_id'] == 'test-swarm-001'
        assert status['interval'] == 60

    def test_start_stop(self, agent):
        """Test starting and stopping the agent."""
        assert agent.running is False

        agent.start()
        assert agent.running is True
        assert agent.thread is not None
        assert agent.thread.is_alive()

        time.sleep(0.1)  # Let thread start

        agent.stop()
        assert agent.running is False

    def test_start_already_running(self, agent, caplog):
        """Test starting an already running agent."""
        agent.start()
        agent.start()  # Try to start again

        assert 'already running' in caplog.text.lower()

        agent.stop()

    def test_stop_not_running(self, agent, caplog):
        """Test stopping an agent that's not running."""
        agent.stop()

        assert 'not running' in caplog.text.lower()

    @patch('core.heartbeat.HeartbeatAgent.send_heartbeat')
    @patch('core.heartbeat.HeartbeatAgent._log_metrics_locally')
    def test_heartbeat_loop_iteration(self, mock_log, mock_send, agent):
        """Test a single iteration of the heartbeat loop."""
        mock_send.return_value = True

        # Start agent with very short interval for testing
        agent.interval = 0.1
        agent.start()

        # Wait for at least one iteration
        time.sleep(0.3)

        agent.stop()

        # Verify heartbeat was sent
        assert mock_send.call_count >= 1
        assert mock_log.call_count >= 1

    def test_generate_swarm_id(self):
        """Test swarm ID generation."""
        agent = HeartbeatAgent(config_path='nonexistent.ini')
        swarm_id = agent.swarm_id

        assert swarm_id is not None
        assert '-' in swarm_id
        assert len(swarm_id) > 0


class TestHeartbeatAgentEdgeCases:
    """Test edge cases and error handling."""

    def test_collect_resource_metrics_error_handling(self, agent):
        """Test that resource metrics handles errors gracefully."""
        with patch('psutil.cpu_percent', side_effect=Exception('CPU error')):
            metrics = agent._collect_resource_metrics()
            assert metrics == {}

    def test_log_metrics_locally_error_handling(self, agent, caplog):
        """Test that local logging handles errors gracefully."""
        with patch('builtins.open', side_effect=PermissionError('Cannot write')):
            metrics = agent.collect_metrics()
            agent._log_metrics_locally(metrics)

            assert 'error logging metrics locally' in caplog.text.lower()

    @responses.activate
    def test_send_heartbeat_unexpected_error(self, agent, caplog):
        """Test handling of unexpected errors during send."""
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            body=Exception('Unexpected error')
        )

        metrics = agent.collect_metrics()
        result = agent.send_heartbeat(metrics)

        assert result is False
        assert 'unexpected error' in caplog.text.lower()
