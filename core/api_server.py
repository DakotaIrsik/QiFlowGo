"""
QiFlow Swarm API Server

Exposes REST API endpoints on the swarm host for polling by the mobile app
and central monitoring backend.

Endpoints:
    GET /health - Health check endpoint
    GET /status - Current swarm status and metrics
    GET /project/completion - Project completion data
    GET /project/issues - Issue list with intervention flags
    GET /agents/activity - Agent activity log
    GET /logs - System logs
"""

import json
import logging
import psutil
from datetime import datetime
from typing import Dict, Any, Optional
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS

from core.heartbeat import HeartbeatAgent
from core.project_tracker import ProjectTracker
from core.agent_monitor import AgentMonitor

logger = logging.getLogger(__name__)


def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')

        # Get API key from server instance
        server = args[0] if args else None
        if server and hasattr(server, 'api_key'):
            if server.api_key and api_key != server.api_key:
                return jsonify({'success': False, 'error': 'Invalid API key'}), 401

        return f(*args, **kwargs)
    return decorated


class SwarmAPIServer:
    """
    Flask-based API server that exposes swarm metrics via REST endpoints.
    """

    def __init__(self, heartbeat_agent: HeartbeatAgent, host: str = '0.0.0.0',
                 port: int = 8080, api_key: Optional[str] = None):
        """
        Initialize the API server.

        Args:
            heartbeat_agent: HeartbeatAgent instance to collect metrics from
            host: Host to bind to (default: 0.0.0.0)
            port: Port to listen on (default: 8080)
            api_key: Optional API key for authentication
        """
        self.heartbeat_agent = heartbeat_agent
        self.host = host
        self.port = port
        self.api_key = api_key

        # Initialize modules
        self.project_tracker = ProjectTracker(heartbeat_agent.config)
        self.agent_monitor = AgentMonitor(heartbeat_agent.config)

        # Create Flask app
        self.app = Flask(__name__)

        # Configure CORS
        cors_origins = heartbeat_agent.config.get('api', 'cors_origins', fallback='*')
        if cors_origins != '*':
            cors_origins = [origin.strip() for origin in cors_origins.split(',')]
        CORS(self.app, origins=cors_origins)

        # Register routes
        self._register_routes()

        logger.info(f"API server initialized on {host}:{port}")

    def _register_routes(self) -> None:
        """Register all API routes."""

        @self.app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint."""
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'swarm_id': self.heartbeat_agent.swarm_id
            })

        @self.app.route('/status', methods=['GET'])
        def status():
            """Get current swarm status and metrics."""
            try:
                # Collect system metrics
                uptime = datetime.utcnow().timestamp() - psutil.boot_time() if hasattr(psutil, 'boot_time') else 0
                cpu_percent = psutil.cpu_percent(interval=0.1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')

                # Get agent metrics
                agent_metrics = self.agent_monitor.get_agent_metrics()

                # Get API quota (placeholder)
                api_quota = {
                    'used': 0,
                    'limit': 100000,
                    'percent_used': 0
                }

                return jsonify({
                    'status': 'online',
                    'uptime_seconds': int(uptime),
                    'last_heartbeat_sent': datetime.utcnow().isoformat(),
                    'resources': {
                        'cpu_percent': cpu_percent,
                        'memory_percent': memory.percent,
                        'disk_percent': disk.percent,
                        'disk_free_gb': round((disk.free / (1024**3)), 2)
                    },
                    'agents': {
                        'total': agent_metrics['total'],
                        'active': agent_metrics['active'],
                        'idle': agent_metrics['idle'],
                        'failed': agent_metrics['failed']
                    },
                    'api_quota': api_quota
                })
            except Exception as e:
                logger.error(f"Error getting status: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/project/completion', methods=['GET'])
        def project_completion():
            """Get project completion data."""
            try:
                completion_data = self.project_tracker.get_completion_metrics()

                return jsonify({
                    'completion_percentage': completion_data['completion_percentage'],
                    'total_issues': completion_data['total_issues'],
                    'completed_issues': completion_data['completed_issues'],
                    'in_progress_issues': completion_data['in_progress_issues'],
                    'ready_issues': completion_data['ready_issues'],
                    'blocked_issues': completion_data['blocked_issues'],
                    'velocity_trend': completion_data['velocity_trend'],
                    'estimated_completion_date': completion_data['estimated_completion_date'],
                    'confidence_level': completion_data['confidence_level'],
                    'last_updated': completion_data['last_updated']
                })
            except Exception as e:
                logger.error(f"Error getting project completion: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/project/issues', methods=['GET'])
        def project_issues():
            """Get paginated issue list with filters."""
            try:
                # Get query parameters
                status_filter = request.args.get('status', None, type=str)
                flagged = request.args.get('flagged', False, type=lambda v: v.lower() == 'true')
                limit = min(request.args.get('limit', 20, type=int), 100)  # Max 100
                offset = request.args.get('offset', 0, type=int)

                # Get issues
                result = self.project_tracker.get_issues(
                    status=status_filter,
                    flagged=flagged,
                    limit=limit,
                    offset=offset
                )

                # Get flagged count
                completion_data = self.project_tracker.get_completion_metrics()
                flagged_count = len(completion_data.get('flagged_issues', []))

                return jsonify({
                    'issues': result['issues'],
                    'total': result['total'],
                    'flagged_count': flagged_count,
                    'pagination': {
                        'limit': result['limit'],
                        'offset': result['offset'],
                        'has_more': result['has_more']
                    }
                })
            except Exception as e:
                logger.error(f"Error getting project issues: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/agents/activity', methods=['GET'])
        def agents_activity():
            """Get agent activity log."""
            try:
                agents = self.agent_monitor.get_agent_activity()

                return jsonify({
                    'agents': agents
                })
            except Exception as e:
                logger.error(f"Error getting agent activity: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/logs', methods=['GET'])
        def logs():
            """Get system logs."""
            try:
                # Get query parameters
                level = request.args.get('level', None, type=str)
                lines = min(request.args.get('lines', 100, type=int), 1000)  # Max 1000

                log_entries = self.agent_monitor.get_system_logs(level=level, lines=lines)

                return jsonify({
                    'logs': log_entries
                })
            except Exception as e:
                logger.error(f"Error getting logs: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

    def run(self, debug: bool = False) -> None:
        """
        Run the API server.

        Args:
            debug: Enable debug mode (default: False)
        """
        logger.info(f"Starting API server on {self.host}:{self.port}")
        self.app.run(host=self.host, port=self.port, debug=debug)


def main():
    """Main entry point for the API server."""
    import argparse

    parser = argparse.ArgumentParser(description='QiFlow Swarm API Server')
    parser.add_argument('--config', default='settings.ini', help='Path to configuration file')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on')
    parser.add_argument('--api-key', help='API key for authentication')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    # Initialize heartbeat agent
    heartbeat_agent = HeartbeatAgent(config_path=args.config)
    heartbeat_agent.start()

    # Get API key from config if not provided via command line
    api_key = args.api_key
    if not api_key:
        api_key = heartbeat_agent.config.get('api', 'api_key', fallback=None)

    # Create and run API server
    server = SwarmAPIServer(heartbeat_agent, host=args.host, port=args.port, api_key=api_key)
    server.run(debug=args.debug)


if __name__ == '__main__':
    main()
