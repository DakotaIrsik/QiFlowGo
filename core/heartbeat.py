"""
QiFlow Swarm Heartbeat Agent Module

Sends real-time status updates to the central monitoring backend and exposes
local API endpoints for polling by the mobile app.

Usage:
    from core.heartbeat import HeartbeatAgent

    agent = HeartbeatAgent(config)
    agent.start()
"""

import os
import sys
import time
import json
import logging
import requests
import psutil
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
from configparser import ConfigParser

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('heartbeat.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class HeartbeatAgent:
    """
    Heartbeat agent that collects swarm metrics and sends them to the
    central monitoring backend every 60 seconds.
    """

    def __init__(self, config_path: str = "settings.ini"):
        """
        Initialize the heartbeat agent.

        Args:
            config_path: Path to the settings.ini configuration file
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Configuration values
        self.monitor_url = self.config.get('heartbeat', 'monitor_url', fallback=None)
        self.api_key = self.config.get('heartbeat', 'api_key', fallback=None)
        self.interval = self.config.getint('heartbeat', 'interval', fallback=60)
        self.swarm_id = self.config.get('heartbeat', 'swarm_id', fallback=self._generate_swarm_id())
        self.github_repo = self.config.get('project_tracking', 'github_repo', fallback=None)

        # Retry configuration
        self.max_retries = 3
        self.retry_delay = 5  # seconds

        logger.info(f"Heartbeat agent initialized for swarm: {self.swarm_id}")

    def _load_config(self) -> ConfigParser:
        """Load configuration from settings.ini file."""
        config = ConfigParser()
        if os.path.exists(self.config_path):
            config.read(self.config_path)
            logger.info(f"Loaded configuration from {self.config_path}")
        else:
            logger.warning(f"Configuration file {self.config_path} not found, using defaults")
        return config

    def _generate_swarm_id(self) -> str:
        """Generate a unique swarm ID based on hostname and timestamp."""
        import socket
        hostname = socket.gethostname()
        return f"{hostname}-{int(time.time())}"

    def collect_metrics(self) -> Dict[str, Any]:
        """
        Collect all swarm metrics including system stats, agent status,
        GitHub activity, and resource usage.

        Returns:
            Dictionary containing all collected metrics
        """
        metrics = {
            'swarm_id': self.swarm_id,
            'timestamp': datetime.utcnow().isoformat(),
            'system': self._collect_system_metrics(),
            'agents': self._collect_agent_metrics(),
            'github': self._collect_github_metrics(),
            'resources': self._collect_resource_metrics(),
            'project': self._collect_project_metrics()
        }

        return metrics

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system-level metrics."""
        return {
            'hostname': os.uname().nodename if hasattr(os, 'uname') else 'unknown',
            'platform': sys.platform,
            'python_version': sys.version.split()[0],
            'uptime_seconds': time.time() - psutil.boot_time() if hasattr(psutil, 'boot_time') else 0
        }

    def _collect_agent_metrics(self) -> Dict[str, Any]:
        """Collect agent status and activity metrics."""
        # Placeholder for agent metrics
        # In a real implementation, this would check running agent processes
        return {
            'active_agents': 0,
            'total_agents': 0,
            'agents_status': []
        }

    def _collect_github_metrics(self) -> Dict[str, Any]:
        """Collect GitHub repository activity metrics."""
        if not self.github_repo:
            return {'enabled': False}

        # Placeholder for GitHub metrics
        # In a real implementation, this would fetch from GitHub API
        return {
            'enabled': True,
            'repository': self.github_repo,
            'open_issues': 0,
            'open_prs': 0,
            'recent_commits': 0
        }

    def _collect_resource_metrics(self) -> Dict[str, Any]:
        """Collect system resource usage metrics."""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            return {
                'cpu_percent': cpu_percent,
                'memory_total_gb': round(memory.total / (1024**3), 2),
                'memory_used_gb': round(memory.used / (1024**3), 2),
                'memory_percent': memory.percent,
                'disk_total_gb': round(disk.total / (1024**3), 2),
                'disk_used_gb': round(disk.used / (1024**3), 2),
                'disk_percent': disk.percent
            }
        except Exception as e:
            logger.error(f"Error collecting resource metrics: {e}")
            return {}

    def _collect_project_metrics(self) -> Dict[str, Any]:
        """Collect project completion and tracking metrics."""
        # Placeholder for project metrics
        # In a real implementation, this would analyze local repository state
        return {
            'completion_percentage': 0,
            'total_issues': 0,
            'completed_issues': 0,
            'blocked_issues': 0,
            'issues_requiring_intervention': []
        }

    def send_heartbeat(self, metrics: Dict[str, Any]) -> bool:
        """
        Send heartbeat data to the central monitoring backend.

        Args:
            metrics: Dictionary containing collected metrics

        Returns:
            True if successful, False otherwise
        """
        if not self.monitor_url:
            logger.warning("Monitor URL not configured, skipping heartbeat send")
            return False

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}' if self.api_key else ''
        }

        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    self.monitor_url,
                    json=metrics,
                    headers=headers,
                    timeout=10
                )

                if response.status_code == 200:
                    logger.info(f"Heartbeat sent successfully for swarm {self.swarm_id}")
                    return True
                else:
                    logger.warning(
                        f"Heartbeat failed with status {response.status_code}: {response.text}"
                    )
            except requests.exceptions.RequestException as e:
                logger.error(f"Network error sending heartbeat (attempt {attempt + 1}/{self.max_retries}): {e}")

                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
            except Exception as e:
                logger.error(f"Unexpected error sending heartbeat: {e}")
                break

        return False

    def _log_metrics_locally(self, metrics: Dict[str, Any]) -> None:
        """
        Log metrics locally for debugging purposes.

        Args:
            metrics: Dictionary containing collected metrics
        """
        try:
            # Create logs directory if it doesn't exist
            log_dir = Path('logs')
            log_dir.mkdir(exist_ok=True)

            # Log to a daily file
            log_file = log_dir / f"heartbeat_{datetime.now().strftime('%Y%m%d')}.json"

            with open(log_file, 'a') as f:
                json.dump(metrics, f)
                f.write('\n')

        except Exception as e:
            logger.error(f"Error logging metrics locally: {e}")

    def _heartbeat_loop(self) -> None:
        """Main heartbeat loop that runs in a separate thread."""
        logger.info(f"Starting heartbeat loop with {self.interval}s interval")

        while self.running:
            try:
                # Collect metrics
                metrics = self.collect_metrics()

                # Send to backend
                success = self.send_heartbeat(metrics)

                # Log locally
                self._log_metrics_locally(metrics)

                if not success:
                    logger.warning("Failed to send heartbeat to backend")

            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")

            # Wait for next interval
            time.sleep(self.interval)

    def start(self) -> None:
        """Start the heartbeat agent in a background thread."""
        if self.running:
            logger.warning("Heartbeat agent already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.thread.start()
        logger.info("Heartbeat agent started")

    def stop(self) -> None:
        """Stop the heartbeat agent."""
        if not self.running:
            logger.warning("Heartbeat agent not running")
            return

        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Heartbeat agent stopped")

    def get_status(self) -> Dict[str, Any]:
        """
        Get current status of the heartbeat agent.

        Returns:
            Dictionary containing agent status
        """
        return {
            'running': self.running,
            'swarm_id': self.swarm_id,
            'monitor_url': self.monitor_url,
            'interval': self.interval,
            'github_repo': self.github_repo
        }


def main():
    """Main entry point for the heartbeat agent."""
    import argparse

    parser = argparse.ArgumentParser(description='QiFlow Swarm Heartbeat Agent')
    parser.add_argument('--config', default='settings.ini', help='Path to configuration file')
    parser.add_argument('--once', action='store_true', help='Send one heartbeat and exit')
    args = parser.parse_args()

    agent = HeartbeatAgent(config_path=args.config)

    if args.once:
        # Send a single heartbeat
        metrics = agent.collect_metrics()
        success = agent.send_heartbeat(metrics)
        agent._log_metrics_locally(metrics)
        sys.exit(0 if success else 1)
    else:
        # Run continuously
        agent.start()

        try:
            # Keep the main thread alive
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
            agent.stop()


if __name__ == '__main__':
    main()
