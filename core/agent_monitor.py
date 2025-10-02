"""
QiFlow Agent Monitor Module

Tracks agent activity, logs, and current tasks.
"""

import logging
import psutil
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class AgentMonitor:
    """
    Monitors agent activity and provides status information.
    """

    def __init__(self, config=None):
        """
        Initialize the agent monitor.

        Args:
            config: Optional ConfigParser instance
        """
        self.config = config
        self.log_dir = Path('logs')

    def get_agent_activity(self) -> List[Dict[str, Any]]:
        """
        Get current agent activity and status.

        Returns:
            List of agent activity dictionaries
        """
        # This is a placeholder implementation
        # In a real system, this would check running agent processes
        agents = []

        try:
            # Look for Python processes that might be agents
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                try:
                    if proc.info['name'] and 'python' in proc.info['name'].lower():
                        cmdline = proc.info.get('cmdline', [])
                        if cmdline and any('agent' in arg.lower() for arg in cmdline):
                            create_time = datetime.fromtimestamp(proc.info['create_time'])
                            uptime_minutes = (datetime.now() - create_time).total_seconds() / 60

                            agents.append({
                                'name': f"Agent-{proc.info['pid']}",
                                'pid': proc.info['pid'],
                                'status': 'active',
                                'uptime_minutes': int(uptime_minutes),
                                'last_activity': datetime.utcnow().isoformat()
                            })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

        except Exception as e:
            logger.error(f"Error getting agent activity: {e}")

        # If no agents found, return placeholder data
        if not agents:
            agents = [{
                'name': 'No active agents',
                'status': 'idle',
                'current_task': None,
                'last_activity': datetime.utcnow().isoformat()
            }]

        return agents

    def get_system_logs(self, level: Optional[str] = None, lines: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent system logs.

        Args:
            level: Filter by log level (info, warning, error)
            lines: Number of log lines to return

        Returns:
            List of log entry dictionaries
        """
        logs = []

        try:
            # Read from heartbeat.log
            log_file = Path('heartbeat.log')
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    log_lines = f.readlines()

                # Get last N lines
                recent_lines = log_lines[-lines:] if len(log_lines) > lines else log_lines

                for line in recent_lines:
                    # Parse log line
                    # Format: 2025-10-02 10:30:00,000 - module - LEVEL - message
                    parts = line.strip().split(' - ', 3)
                    if len(parts) >= 4:
                        timestamp_str = parts[0]
                        log_level = parts[2] if len(parts) > 2 else 'INFO'
                        message = parts[3] if len(parts) > 3 else line.strip()

                        # Apply level filter
                        if level and log_level.lower() != level.lower():
                            continue

                        logs.append({
                            'timestamp': timestamp_str,
                            'level': log_level,
                            'message': message
                        })

        except Exception as e:
            logger.error(f"Error reading logs: {e}")

        return logs

    def get_agent_metrics(self) -> Dict[str, Any]:
        """
        Get aggregate agent metrics.

        Returns:
            Dictionary with agent metrics
        """
        agents = self.get_agent_activity()

        active = sum(1 for agent in agents if agent.get('status') == 'active')
        idle = sum(1 for agent in agents if agent.get('status') == 'idle')
        failed = sum(1 for agent in agents if agent.get('status') == 'failed')

        return {
            'total': len(agents),
            'active': active,
            'idle': idle,
            'failed': failed
        }
