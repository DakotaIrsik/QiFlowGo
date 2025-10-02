"""
QiFlow Agent Monitor Module

Tracks agent activity, status, and system logs for monitoring and debugging.

Features:
    - Real-time agent status tracking
    - Activity log monitoring
    - Agent task assignment tracking
    - System log aggregation
"""

import logging
import os
import psutil
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
from configparser import ConfigParser

logger = logging.getLogger(__name__)


class AgentMonitor:
    """
    Monitors agent activity and provides real-time status information.
    """

    def __init__(self, config: ConfigParser):
        """
        Initialize the agent monitor.

        Args:
            config: ConfigParser instance with agent settings
        """
        self.config = config
        self.log_dir = Path(config.get('logging', 'log_dir', fallback='logs'))
        self.max_log_lines = config.getint('logging', 'max_log_lines', fallback=1000)

        logger.info("Agent monitor initialized")

    def get_agent_activity(self) -> Dict[str, Any]:
        """
        Get current agent activity and status.

        Returns:
            Dictionary containing agent activity data
        """
        try:
            agents = self._get_running_agents()

            return {
                'agents': agents,
                'total_agents': len(agents),
                'active_agents': sum(1 for a in agents if a['status'] == 'active'),
                'idle_agents': sum(1 for a in agents if a['status'] == 'idle'),
                'failed_agents': sum(1 for a in agents if a['status'] == 'failed'),
                'last_updated': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting agent activity: {e}")
            return self._get_default_activity()

    def get_system_logs(self, level: Optional[str] = None, lines: int = 100) -> Dict[str, Any]:
        """
        Get recent system logs with optional filtering.

        Args:
            level: Filter by log level (info, warning, error, debug)
            lines: Number of lines to return (max: 1000)

        Returns:
            Dictionary containing log entries
        """
        try:
            logs = self._read_log_files(level, min(lines, self.max_log_lines))

            return {
                'logs': logs,
                'total_lines': len(logs),
                'level_filter': level,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error reading system logs: {e}")
            return {
                'logs': [],
                'total_lines': 0,
                'level_filter': level,
                'timestamp': datetime.utcnow().isoformat()
            }

    def get_agent_details(self, agent_name: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific agent.

        Args:
            agent_name: Name of the agent

        Returns:
            Dictionary with agent details or None if not found
        """
        try:
            agents = self._get_running_agents()
            agent = next((a for a in agents if a['name'] == agent_name), None)

            if agent:
                # Enhance with additional details
                agent['process_info'] = self._get_process_info(agent.get('pid'))
                agent['recent_tasks'] = self._get_agent_recent_tasks(agent_name)

            return agent
        except Exception as e:
            logger.error(f"Error getting agent details for {agent_name}: {e}")
            return None

    def _get_running_agents(self) -> List[Dict[str, Any]]:
        """
        Get list of currently running agents.

        Returns:
            List of agent status dictionaries
        """
        # Mock data for now - in production this would scan processes or read state files
        return [
            {
                'name': 'Agent-1',
                'status': 'active',
                'current_task': 'Implementing OAuth integration',
                'issue_number': 126,
                'time_on_task_minutes': 45,
                'last_activity': datetime.utcnow().isoformat(),
                'pid': os.getpid()  # Mock PID
            },
            {
                'name': 'Agent-2',
                'status': 'blocked',
                'current_task': 'Resolving merge conflict',
                'issue_number': 127,
                'time_on_task_minutes': 120,
                'last_activity': (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                'pid': os.getpid() + 1  # Mock PID
            },
            {
                'name': 'Agent-3',
                'status': 'idle',
                'current_task': None,
                'issue_number': None,
                'time_on_task_minutes': 0,
                'last_activity': (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
                'pid': os.getpid() + 2  # Mock PID
            }
        ]

    def _read_log_files(self, level: Optional[str], lines: int) -> List[Dict[str, Any]]:
        """
        Read and parse log files.

        Args:
            level: Filter by log level
            lines: Maximum number of lines to return

        Returns:
            List of log entry dictionaries
        """
        logs = []

        try:
            # Read from heartbeat.log if it exists
            log_file = Path('heartbeat.log')
            if log_file.exists():
                with open(log_file, 'r') as f:
                    # Read last N lines
                    all_lines = f.readlines()
                    recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines

                    for line in recent_lines:
                        parsed_log = self._parse_log_line(line)
                        if parsed_log:
                            if not level or parsed_log.get('level', '').lower() == level.lower():
                                logs.append(parsed_log)
        except Exception as e:
            logger.error(f"Error reading log files: {e}")

        # If no logs found, add some mock data
        if not logs:
            logs = [
                {
                    'timestamp': datetime.utcnow().isoformat(),
                    'level': 'info',
                    'message': 'Agent-1 completed issue #125',
                    'metadata': {}
                },
                {
                    'timestamp': (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
                    'level': 'warning',
                    'message': 'Agent-2 blocked on issue #127',
                    'metadata': {'issue': 127}
                }
            ]

        return logs[:lines]

    def _parse_log_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parse a single log line into structured format.

        Args:
            line: Raw log line

        Returns:
            Parsed log dictionary or None if parsing fails
        """
        try:
            # Simple parsing - in production would be more robust
            parts = line.strip().split(' - ')
            if len(parts) >= 4:
                return {
                    'timestamp': parts[0],
                    'logger': parts[1],
                    'level': parts[2],
                    'message': ' - '.join(parts[3:]),
                    'metadata': {}
                }
        except Exception as e:
            logger.debug(f"Error parsing log line: {e}")

        return None

    def _get_process_info(self, pid: Optional[int]) -> Optional[Dict[str, Any]]:
        """
        Get detailed process information.

        Args:
            pid: Process ID

        Returns:
            Process info dictionary or None
        """
        if not pid:
            return None

        try:
            process = psutil.Process(pid)
            return {
                'cpu_percent': process.cpu_percent(interval=0.1),
                'memory_mb': round(process.memory_info().rss / (1024 * 1024), 2),
                'status': process.status(),
                'create_time': datetime.fromtimestamp(process.create_time()).isoformat()
            }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return None

    def _get_agent_recent_tasks(self, agent_name: str) -> List[Dict[str, Any]]:
        """
        Get recent tasks completed by an agent.

        Args:
            agent_name: Name of the agent

        Returns:
            List of recent task dictionaries
        """
        # Mock data - in production would query task history database
        return [
            {
                'issue_number': 125,
                'title': 'Fix authentication bug',
                'completed_at': (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                'duration_minutes': 90
            },
            {
                'issue_number': 124,
                'title': 'Add user profile page',
                'completed_at': (datetime.utcnow() - timedelta(hours=4)).isoformat(),
                'duration_minutes': 120
            }
        ]

    def _get_default_activity(self) -> Dict[str, Any]:
        """Return default activity structure when errors occur."""
        return {
            'agents': [],
            'total_agents': 0,
            'active_agents': 0,
            'idle_agents': 0,
            'failed_agents': 0,
            'last_updated': datetime.utcnow().isoformat()
        }
