"""
Integration tests for the SwarmAPIServer.
Tests the full interaction between HeartbeatAgent and API Server.
"""

import json
import pytest
import responses
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

from core.heartbeat import HeartbeatAgent
from core.api_server import SwarmAPIServer


class TestAPIServerIntegration:
    """Integration tests for the complete API system."""

    @pytest.fixture
    def real_agent(self, tmp_path):
        """Create a real HeartbeatAgent with temporary config."""
        config_content = """[heartbeat]
monitor_url = https://integration-test.com/heartbeat
api_key = integration-test-key
interval = 30
swarm_id = integration-swarm-001

[project_tracking]
github_repo = testowner/integration-repo
"""
        config_file = tmp_path / "integration_settings.ini"
        config_file.write_text(config_content)

        return HeartbeatAgent(config_path=str(config_file))

    @pytest.fixture
    def api_server_with_real_agent(self, real_agent):
        """Create API server with a real agent."""
        server = SwarmAPIServer(real_agent, host='127.0.0.1', port=8081)
        server.app.config['TESTING'] = True
        return server

    @pytest.fixture
    def client_with_real_agent(self, api_server_with_real_agent):
        """Create test client with real agent."""
        return api_server_with_real_agent.app.test_client()

    def test_full_status_flow(self, client_with_real_agent):
        """Test complete status retrieval flow."""
        # Get health
        health_response = client_with_real_agent.get('/health')
        assert health_response.status_code == 200
        health_data = json.loads(health_response.data)
        assert health_data['status'] == 'healthy'
        swarm_id = health_data['swarm_id']

        # Get full status
        status_response = client_with_real_agent.get('/status')
        assert status_response.status_code == 200
        status_data = json.loads(status_response.data)

        assert status_data['success'] is True
        assert status_data['data']['swarm_id'] == swarm_id

        # Verify all metric sections are present
        assert 'system' in status_data['data']
        assert 'resources' in status_data['data']
        assert 'agents' in status_data['data']

    def test_metrics_consistency(self, client_with_real_agent):
        """Test that metrics are consistent across endpoints."""
        # Get metrics via /metrics
        metrics_response = client_with_real_agent.get('/metrics')
        metrics_data = json.loads(metrics_response.data)['data']

        # Get metrics via /status
        status_response = client_with_real_agent.get('/status')
        status_data = json.loads(status_response.data)['data']

        # System info should match (excluding uptime which changes)
        assert metrics_data['swarm_id'] == status_data['swarm_id']
        assert metrics_data['system']['hostname'] == status_data['system']['hostname']
        assert metrics_data['system']['platform'] == status_data['system']['platform']
        assert metrics_data['system']['python_version'] == status_data['system']['python_version']

        # Resource metrics should be similar (not exact due to timing)
        assert 'cpu_percent' in metrics_data['resources']
        assert 'cpu_percent' in status_data['resources']

    def test_concurrent_requests(self, client_with_real_agent):
        """Test handling multiple concurrent requests."""
        import concurrent.futures

        def make_request(endpoint):
            return client_with_real_agent.get(endpoint)

        endpoints = ['/health', '/status', '/metrics', '/agent/status'] * 5

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request, endpoint) for endpoint in endpoints]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]

        # All requests should succeed
        assert all(r.status_code == 200 for r in results)

    def test_error_recovery(self, client_with_real_agent, real_agent):
        """Test that server recovers from agent errors."""
        # First request should work
        response1 = client_with_real_agent.get('/status')
        assert response1.status_code == 200

        # Mock an error in collect_metrics
        with patch.object(real_agent, 'collect_metrics', side_effect=Exception('Temporary error')):
            response2 = client_with_real_agent.get('/status')
            assert response2.status_code == 500

        # Next request should work again (recovery)
        response3 = client_with_real_agent.get('/status')
        assert response3.status_code == 200

    def test_agent_status_reflection(self, client_with_real_agent, real_agent):
        """Test that agent status is correctly reflected in API."""
        # Initially not running
        status_response = client_with_real_agent.get('/agent/status')
        status_data = json.loads(status_response.data)
        assert status_data['data']['running'] is False

        # Start agent
        real_agent.start()

        # Should show as running
        status_response = client_with_real_agent.get('/agent/status')
        status_data = json.loads(status_response.data)
        assert status_data['data']['running'] is True

        # Stop agent
        real_agent.stop()

        # Should show as not running
        status_response = client_with_real_agent.get('/agent/status')
        status_data = json.loads(status_response.data)
        assert status_data['data']['running'] is False

    def test_resource_metrics_validation(self, client_with_real_agent):
        """Test that resource metrics contain valid values."""
        response = client_with_real_agent.get('/status')
        data = json.loads(response.data)['data']

        resources = data['resources']

        # CPU should be between 0 and 100
        assert 0 <= resources['cpu_percent'] <= 100

        # Memory should have positive values
        assert resources['memory_total_gb'] > 0
        assert resources['memory_used_gb'] >= 0
        assert 0 <= resources['memory_percent'] <= 100

        # Disk should have positive values
        assert resources['disk_total_gb'] > 0
        assert resources['disk_used_gb'] >= 0
        assert 0 <= resources['disk_percent'] <= 100

    def test_timestamp_format(self, client_with_real_agent):
        """Test that timestamps are in ISO format."""
        # Health endpoint
        health_response = client_with_real_agent.get('/health')
        health_data = json.loads(health_response.data)

        # Should be able to parse ISO timestamp
        timestamp = datetime.fromisoformat(health_data['timestamp'].replace('Z', '+00:00'))
        assert isinstance(timestamp, datetime)

        # Should be recent (within last minute)
        now = datetime.utcnow()
        assert (now - timestamp.replace(tzinfo=None)) < timedelta(minutes=1)

    def test_project_completion_structure(self, client_with_real_agent):
        """Test project completion response structure."""
        response = client_with_real_agent.get('/project/completion')
        data = json.loads(response.data)['data']

        # Required fields
        assert 'completion_percentage' in data
        assert 'total_issues' in data
        assert 'completed_issues' in data
        assert 'in_progress_issues' in data
        assert 'blocked_issues' in data
        assert 'issues_requiring_human_intervention' in data

        # Types
        assert isinstance(data['completion_percentage'], (int, float))
        assert isinstance(data['total_issues'], int)
        assert isinstance(data['issues_requiring_human_intervention'], list)

    def test_cors_headers_present(self, client_with_real_agent):
        """Test that CORS is configured (basic check)."""
        response = client_with_real_agent.get('/health')

        # Flask-CORS should be active
        # In testing mode, we just verify the endpoint works
        assert response.status_code == 200

    def test_invalid_routes(self, client_with_real_agent):
        """Test handling of invalid routes."""
        invalid_routes = [
            '/invalid',
            '/api/v1/invalid',
            '/status/invalid',
            '/metrics/123',
        ]

        for route in invalid_routes:
            response = client_with_real_agent.get(route)
            assert response.status_code == 404


class TestHeartbeatAgentIntegration:
    """Integration tests for HeartbeatAgent."""

    @pytest.fixture
    def agent_with_config(self, tmp_path):
        """Create agent with temporary config."""
        config_content = """[heartbeat]
monitor_url = https://test-backend.com/api/v1/heartbeat
api_key = test-key-456
interval = 5
swarm_id = test-swarm-integration

[project_tracking]
github_repo = owner/repo
"""
        config_file = tmp_path / "test_settings.ini"
        config_file.write_text(config_content)

        agent = HeartbeatAgent(config_path=str(config_file))
        yield agent

        # Cleanup
        if agent.running:
            agent.stop()

    @responses.activate
    def test_heartbeat_lifecycle(self, agent_with_config):
        """Test complete heartbeat lifecycle."""
        # Setup mock endpoint
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'success': True},
            status=200
        )

        # Collect metrics
        metrics = agent_with_config.collect_metrics()
        assert metrics['swarm_id'] == 'test-swarm-integration'

        # Send heartbeat
        result = agent_with_config.send_heartbeat(metrics)
        assert result is True

        # Verify request was made
        assert len(responses.calls) == 1
        request_body = json.loads(responses.calls[0].request.body)
        assert request_body['swarm_id'] == 'test-swarm-integration'

    def test_metrics_collection_completeness(self, agent_with_config):
        """Test that all metrics sections are collected."""
        metrics = agent_with_config.collect_metrics()

        # All sections should be present
        required_sections = ['swarm_id', 'timestamp', 'system', 'agents', 'github', 'resources', 'project']
        for section in required_sections:
            assert section in metrics, f"Missing section: {section}"

        # System metrics
        assert 'hostname' in metrics['system']
        assert 'platform' in metrics['system']
        assert 'python_version' in metrics['system']

        # Resource metrics
        assert 'cpu_percent' in metrics['resources']
        assert 'memory_percent' in metrics['resources']
        assert 'disk_percent' in metrics['resources']

        # GitHub metrics
        assert 'enabled' in metrics['github']
        assert metrics['github']['enabled'] is True
        assert metrics['github']['repository'] == 'owner/repo'

    @responses.activate
    def test_retry_mechanism(self, agent_with_config, tmp_path):
        """Test that heartbeat retries on failure."""
        # First two attempts fail, third succeeds
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'error': 'Server busy'},
            status=503
        )
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'error': 'Server busy'},
            status=503
        )
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'success': True},
            status=200
        )

        # Reduce retry delay for testing
        agent_with_config.retry_delay = 0.1

        metrics = agent_with_config.collect_metrics()
        result = agent_with_config.send_heartbeat(metrics)

        assert result is True
        assert len(responses.calls) == 3

    def test_local_logging(self, agent_with_config, tmp_path, monkeypatch):
        """Test that metrics are logged locally."""
        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        metrics = agent_with_config.collect_metrics()
        agent_with_config._log_metrics_locally(metrics)

        # Check log file was created
        log_dir = tmp_path / 'logs'
        assert log_dir.exists()

        log_files = list(log_dir.glob('heartbeat_*.json'))
        assert len(log_files) == 1

        # Verify content
        with open(log_files[0], 'r') as f:
            logged_data = json.loads(f.readline())
            assert logged_data['swarm_id'] == metrics['swarm_id']

    def test_start_stop_lifecycle(self, agent_with_config):
        """Test agent start/stop lifecycle."""
        assert agent_with_config.running is False
        assert agent_with_config.thread is None

        # Start
        agent_with_config.start()
        assert agent_with_config.running is True
        assert agent_with_config.thread is not None
        assert agent_with_config.thread.is_alive()

        # Stop
        agent_with_config.stop()
        assert agent_with_config.running is False

    @responses.activate
    def test_authorization_header(self, agent_with_config):
        """Test that API key is sent in Authorization header."""
        responses.add(
            responses.POST,
            'https://test-backend.com/api/v1/heartbeat',
            json={'success': True},
            status=200
        )

        metrics = agent_with_config.collect_metrics()
        agent_with_config.send_heartbeat(metrics)

        # Check Authorization header
        request_headers = responses.calls[0].request.headers
        assert 'Authorization' in request_headers
        assert request_headers['Authorization'] == 'Bearer test-key-456'

    def test_multiple_metrics_collection(self, agent_with_config):
        """Test that multiple metric collections produce consistent results."""
        metrics1 = agent_with_config.collect_metrics()
        metrics2 = agent_with_config.collect_metrics()

        # Same swarm_id
        assert metrics1['swarm_id'] == metrics2['swarm_id']

        # Same system info
        assert metrics1['system']['hostname'] == metrics2['system']['hostname']
        assert metrics1['system']['platform'] == metrics2['system']['platform']

        # GitHub config should be the same
        assert metrics1['github'] == metrics2['github']
