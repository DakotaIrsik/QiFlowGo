"""
QiFlow Swarm API Server

Exposes REST API endpoints on the swarm host for polling by the mobile app
and central monitoring backend.

Endpoints:
    GET /status - Current swarm status and metrics
    GET /project/completion - Project completion data
    GET /project/issues - Issue list with intervention flags
    GET /health - Health check endpoint
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from flask import Flask, jsonify, request
from flask_cors import CORS

from core.heartbeat import HeartbeatAgent

logger = logging.getLogger(__name__)


class SwarmAPIServer:
    """
    Flask-based API server that exposes swarm metrics via REST endpoints.
    """

    def __init__(self, heartbeat_agent: HeartbeatAgent, host: str = '0.0.0.0', port: int = 8080):
        """
        Initialize the API server.

        Args:
            heartbeat_agent: HeartbeatAgent instance to collect metrics from
            host: Host to bind to (default: 0.0.0.0)
            port: Port to listen on (default: 8080)
        """
        self.heartbeat_agent = heartbeat_agent
        self.host = host
        self.port = port

        # Create Flask app
        self.app = Flask(__name__)
        CORS(self.app)  # Enable CORS for mobile app access

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
                metrics = self.heartbeat_agent.collect_metrics()
                return jsonify({
                    'success': True,
                    'data': {
                        'swarm_id': metrics['swarm_id'],
                        'timestamp': metrics['timestamp'],
                        'system': metrics['system'],
                        'resources': metrics['resources'],
                        'agents': metrics['agents']
                    }
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
                metrics = self.heartbeat_agent.collect_metrics()
                project_data = metrics.get('project', {})

                return jsonify({
                    'success': True,
                    'data': {
                        'completion_percentage': project_data.get('completion_percentage', 0),
                        'total_issues': project_data.get('total_issues', 0),
                        'completed_issues': project_data.get('completed_issues', 0),
                        'in_progress_issues': project_data.get('in_progress_issues', 0),
                        'blocked_issues': project_data.get('blocked_issues', 0),
                        'issues_requiring_human_intervention': project_data.get('issues_requiring_intervention', []),
                        'estimated_completion_date': project_data.get('estimated_completion_date'),
                        'velocity_trend': project_data.get('velocity_trend', 0)
                    }
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
                page = request.args.get('page', 1, type=int)
                limit = request.args.get('limit', 20, type=int)
                status_filter = request.args.get('status', None, type=str)
                flagged_only = request.args.get('flagged', False, type=bool)

                # Placeholder for issue data
                # In a real implementation, this would fetch from GitHub API or local cache
                issues = []

                return jsonify({
                    'success': True,
                    'data': {
                        'issues': issues,
                        'page': page,
                        'limit': limit,
                        'total': len(issues)
                    }
                })
            except Exception as e:
                logger.error(f"Error getting project issues: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/metrics', methods=['GET'])
        def metrics():
            """Get all collected metrics."""
            try:
                all_metrics = self.heartbeat_agent.collect_metrics()
                return jsonify({
                    'success': True,
                    'data': all_metrics
                })
            except Exception as e:
                logger.error(f"Error getting metrics: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500

        @self.app.route('/agent/status', methods=['GET'])
        def agent_status():
            """Get heartbeat agent status."""
            try:
                status = self.heartbeat_agent.get_status()
                return jsonify({
                    'success': True,
                    'data': status
                })
            except Exception as e:
                logger.error(f"Error getting agent status: {e}")
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
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    # Initialize heartbeat agent
    heartbeat_agent = HeartbeatAgent(config_path=args.config)
    heartbeat_agent.start()

    # Create and run API server
    server = SwarmAPIServer(heartbeat_agent, host=args.host, port=args.port)
    server.run(debug=args.debug)


if __name__ == '__main__':
    main()
