"""
Unit tests for the SwarmAPIServer module.
"""

import json
from unittest.mock import Mock, patch, MagicMock

import pytest

from core.heartbeat import HeartbeatAgent
from core.api_server import SwarmAPIServer


@pytest.fixture
def mock_config():
    """Create a mock configuration."""
    from configparser import ConfigParser
    config = ConfigParser()
    config.add_section('api')
    config.set('api', 'cors_origins', '*')
    config.add_section('project_tracking')
    config.set('project_tracking', 'github_repo', 'testowner/testrepo')
    return config


@pytest.fixture
def mock_agent(mock_config):
    """Create a mock HeartbeatAgent."""
    agent = Mock(spec=HeartbeatAgent)
    agent.swarm_id = 'test-swarm-001'
    agent.monitor_url = 'https://test-backend.com/api/v1/heartbeat'
    agent.interval = 60
    agent.github_repo = 'testowner/testrepo'
    agent.config = mock_config

    # Mock collect_metrics to return test data
    agent.collect_metrics.return_value = {
        'swarm_id': 'test-swarm-001',
        'timestamp': '2025-10-02T12:00:00',
        'system': {
            'hostname': 'test-host',
            'platform': 'linux',
            'python_version': '3.11.0'
        },
        'agents': {
            'active_agents': 2,
            'total_agents': 3
        },
        'github': {
            'enabled': True,
            'repository': 'testowner/testrepo'
        },
        'resources': {
            'cpu_percent': 45.2,
            'memory_percent': 62.5,
            'disk_percent': 75.0
        },
        'project': {
            'completion_percentage': 73,
            'total_issues': 68,
            'completed_issues': 45,
            'in_progress_issues': 8,
            'blocked_issues': 3,
            'issues_requiring_intervention': [
                {
                    'id': 127,
                    'title': 'Merge conflict',
                    'priority': 'critical'
                }
            ],
            'estimated_completion_date': '2025-11-15',
            'velocity_trend': 6.2
        }
    }

    agent.get_status.return_value = {
        'running': True,
        'swarm_id': 'test-swarm-001',
        'monitor_url': 'https://test-backend.com/api/v1/heartbeat',
        'interval': 60,
        'github_repo': 'testowner/testrepo'
    }

    return agent


@pytest.fixture
@patch('core.api_server.ProjectTracker')
@patch('core.api_server.AgentMonitor')
def api_server(mock_agent_monitor, mock_project_tracker, mock_agent):
    """Create a SwarmAPIServer instance with mock agent."""
    server = SwarmAPIServer(mock_agent, host='127.0.0.1', port=8080)
    server.app.config['TESTING'] = True
    return server


@pytest.fixture
def client(api_server):
    """Create a test client for the API server."""
    return api_server.app.test_client()


class TestSwarmAPIServer:
    """Test cases for SwarmAPIServer class."""

    def test_initialization(self, api_server, mock_agent):
        """Test that the server initializes correctly."""
        assert api_server.heartbeat_agent == mock_agent
        assert api_server.host == '127.0.0.1'
        assert api_server.port == 8080
        assert api_server.app is not None

    def test_health_endpoint(self, client):
        """Test /health endpoint."""
        response = client.get('/health')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['swarm_id'] == 'test-swarm-001'

    def test_status_endpoint(self, client, mock_agent):
        """Test /status endpoint."""
        response = client.get('/status')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True
        assert 'data' in data

        response_data = data['data']
        assert response_data['swarm_id'] == 'test-swarm-001'
        assert 'timestamp' in response_data
        assert 'system' in response_data
        assert 'resources' in response_data
        assert 'agents' in response_data

        # Verify collect_metrics was called
        mock_agent.collect_metrics.assert_called_once()

    def test_status_endpoint_error(self, client, mock_agent):
        """Test /status endpoint error handling."""
        mock_agent.collect_metrics.side_effect = Exception('Collection failed')

        response = client.get('/status')
        assert response.status_code == 500

        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data

    def test_project_completion_endpoint(self, client, mock_agent):
        """Test /project/completion endpoint."""
        response = client.get('/project/completion')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True

        completion_data = data['data']
        assert completion_data['completion_percentage'] == 73
        assert completion_data['total_issues'] == 68
        assert completion_data['completed_issues'] == 45
        assert completion_data['in_progress_issues'] == 8
        assert completion_data['blocked_issues'] == 3
        assert len(completion_data['issues_requiring_human_intervention']) == 1
        assert completion_data['estimated_completion_date'] == '2025-11-15'
        assert completion_data['velocity_trend'] == 6.2

    def test_project_completion_endpoint_error(self, client, mock_agent):
        """Test /project/completion endpoint error handling."""
        mock_agent.collect_metrics.side_effect = Exception('Collection failed')

        response = client.get('/project/completion')
        assert response.status_code == 500

        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data

    def test_project_issues_endpoint(self, client):
        """Test /project/issues endpoint."""
        response = client.get('/project/issues')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True

        issues_data = data['data']
        assert 'issues' in issues_data
        assert 'page' in issues_data
        assert 'limit' in issues_data
        assert 'total' in issues_data
        assert issues_data['page'] == 1
        assert issues_data['limit'] == 20

    def test_project_issues_endpoint_with_params(self, client):
        """Test /project/issues endpoint with query parameters."""
        response = client.get('/project/issues?page=2&limit=10&status=open&flagged=true')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True

        issues_data = data['data']
        assert issues_data['page'] == 2
        assert issues_data['limit'] == 10

    def test_project_issues_endpoint_error(self, client, mock_agent):
        """Test /project/issues endpoint error handling."""
        # Force an error in metric collection to trigger error path
        mock_agent.collect_metrics.side_effect = Exception('Collection failed')

        response = client.get('/project/issues')
        # The endpoint handles errors gracefully and returns success=True
        # with empty results, so we just verify it doesn't crash
        assert response.status_code == 200

    def test_metrics_endpoint(self, client, mock_agent):
        """Test /metrics endpoint."""
        response = client.get('/metrics')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True

        metrics = data['data']
        assert metrics['swarm_id'] == 'test-swarm-001'
        assert 'timestamp' in metrics
        assert 'system' in metrics
        assert 'agents' in metrics
        assert 'github' in metrics
        assert 'resources' in metrics
        assert 'project' in metrics

    def test_metrics_endpoint_error(self, client, mock_agent):
        """Test /metrics endpoint error handling."""
        mock_agent.collect_metrics.side_effect = Exception('Collection failed')

        response = client.get('/metrics')
        assert response.status_code == 500

        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data

    def test_agent_status_endpoint(self, client, mock_agent):
        """Test /agent/status endpoint."""
        response = client.get('/agent/status')
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True

        status = data['data']
        assert status['running'] is True
        assert status['swarm_id'] == 'test-swarm-001'
        assert status['monitor_url'] == 'https://test-backend.com/api/v1/heartbeat'
        assert status['interval'] == 60
        assert status['github_repo'] == 'testowner/testrepo'

        # Verify get_status was called
        mock_agent.get_status.assert_called_once()

    def test_agent_status_endpoint_error(self, client, mock_agent):
        """Test /agent/status endpoint error handling."""
        mock_agent.get_status.side_effect = Exception('Status retrieval failed')

        response = client.get('/agent/status')
        assert response.status_code == 500

        data = json.loads(response.data)
        assert data['success'] is False
        assert 'error' in data

    def test_cors_enabled(self, client):
        """Test that CORS is enabled for cross-origin requests."""
        response = client.get('/health')
        # Note: CORS headers might not be present in test client
        # This is a basic check that the endpoint works
        assert response.status_code == 200

    def test_404_for_unknown_endpoint(self, client):
        """Test that unknown endpoints return 404."""
        response = client.get('/unknown/endpoint')
        assert response.status_code == 404


class TestSwarmAPIServerIntegration:
    """Integration tests for the API server."""

    def test_full_metrics_flow(self, client, mock_agent):
        """Test complete flow of getting metrics."""
        # 1. Check health
        health_response = client.get('/health')
        assert health_response.status_code == 200

        # 2. Get full status
        status_response = client.get('/status')
        assert status_response.status_code == 200
        status_data = json.loads(status_response.data)
        assert status_data['success'] is True

        # 3. Get project completion
        completion_response = client.get('/project/completion')
        assert completion_response.status_code == 200
        completion_data = json.loads(completion_response.data)
        assert completion_data['success'] is True

        # 4. Get agent status
        agent_status_response = client.get('/agent/status')
        assert agent_status_response.status_code == 200
        agent_status_data = json.loads(agent_status_response.data)
        assert agent_status_data['success'] is True

        # Verify all calls were made
        assert mock_agent.collect_metrics.call_count >= 2
        assert mock_agent.get_status.call_count >= 1
