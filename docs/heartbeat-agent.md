# QiFlow Swarm Heartbeat Agent

## Overview

The Swarm Heartbeat Agent is a critical component of the QiFlow Control Center ecosystem. It runs on each QiFlow swarm deployment and provides:

1. **Real-time Status Updates**: Sends heartbeat data to the central monitoring backend every 60 seconds
2. **Local API Server**: Exposes REST endpoints for direct polling by the mobile app
3. **Metrics Collection**: Gathers system metrics, agent status, GitHub activity, and resource usage
4. **Error Handling**: Gracefully handles network failures with automatic retry logic

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QiFlow Swarm Host                         │
│                                                               │
│  ┌──────────────────────┐      ┌─────────────────────────┐  │
│  │  Heartbeat Agent     │──────│  API Server             │  │
│  │  (core/heartbeat.py) │      │  (core/api_server.py)   │  │
│  └──────────────────────┘      └─────────────────────────┘  │
│           │                              │                   │
│           │ Push (every 60s)             │ Poll (on-demand)  │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            ▼                              ▼
   ┌────────────────┐          ┌─────────────────────┐
   │ Central Backend│          │ Mobile App / Client │
   │   (Node.js)    │          │  (React Native)     │
   └────────────────┘          └─────────────────────┘
```

## Installation

### Prerequisites

- Python 3.8+
- pip or poetry for package management

### Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure the agent**:
   ```bash
   cp settings.ini.example settings.ini
   # Edit settings.ini with your configuration
   ```

3. **Test the installation**:
   ```bash
   python -m core.heartbeat --once
   ```

## Configuration

### settings.ini

```ini
[heartbeat]
# URL of the central monitoring backend
monitor_url = https://your-backend.com/api/v1/heartbeat

# API key for authentication
api_key = your-swarm-api-key

# Heartbeat interval in seconds
interval = 60

# Unique identifier for this swarm (auto-generated if empty)
swarm_id =

# Enable local API server
enable_api = true

# Port for the API server
api_port = 8080

[project_tracking]
# Enable project tracking
enabled = true

# GitHub repository (owner/repo)
github_repo = owner/repo

# GitHub personal access token
github_token =

# Hours before flagging blocked issues
flag_blocked_after_hours = 24

# Consecutive failures before flagging
flag_failures_threshold = 3

# Test failure rate threshold (0.10 = 10%)
flag_test_failure_rate = 0.10
```

## Usage

### Running the Heartbeat Agent

**Continuous Mode (Daemon)**:
```bash
python -m core.heartbeat
```

**Single Heartbeat**:
```bash
python -m core.heartbeat --once
```

**Custom Configuration**:
```bash
python -m core.heartbeat --config /path/to/settings.ini
```

### Running the API Server

**Start the API server**:
```bash
python -m core.api_server
```

**Custom host and port**:
```bash
python -m core.api_server --host 0.0.0.0 --port 8080
```

**Debug mode**:
```bash
python -m core.api_server --debug
```

### Integration with QiFlow Swarms

Add to your QiFlow swarm startup script:

```bash
#!/bin/bash
# Start the heartbeat agent
python -m core.heartbeat &

# Start the API server
python -m core.api_server &

# Start your QiFlow swarm
python main.py
```

## API Endpoints

### Health Check
**GET** `/health`

Returns the health status of the swarm.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T12:00:00",
  "swarm_id": "test-swarm-001"
}
```

### Current Status
**GET** `/status`

Returns current swarm status and metrics.

**Response**:
```json
{
  "success": true,
  "data": {
    "swarm_id": "test-swarm-001",
    "timestamp": "2025-10-02T12:00:00",
    "system": {
      "hostname": "swarm-host-1",
      "platform": "linux",
      "python_version": "3.11.0"
    },
    "resources": {
      "cpu_percent": 45.2,
      "memory_percent": 62.5,
      "disk_percent": 75.0
    },
    "agents": {
      "active_agents": 2,
      "total_agents": 3
    }
  }
}
```

### Project Completion
**GET** `/project/completion`

Returns project completion metrics.

**Response**:
```json
{
  "success": true,
  "data": {
    "completion_percentage": 73,
    "total_issues": 68,
    "completed_issues": 45,
    "in_progress_issues": 8,
    "blocked_issues": 3,
    "issues_requiring_human_intervention": [
      {
        "id": 127,
        "title": "Merge conflict in auth module",
        "priority": "critical"
      }
    ],
    "estimated_completion_date": "2025-11-15",
    "velocity_trend": 6.2
  }
}
```

### Project Issues
**GET** `/project/issues?page=1&limit=20&status=open&flagged=true`

Returns paginated list of issues with filters.

**Query Parameters**:
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 20)
- `status` (string): Filter by status (open, closed, all)
- `flagged` (boolean): Show only flagged issues

**Response**:
```json
{
  "success": true,
  "data": {
    "issues": [],
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

### All Metrics
**GET** `/metrics`

Returns all collected metrics.

**Response**:
```json
{
  "success": true,
  "data": {
    "swarm_id": "test-swarm-001",
    "timestamp": "2025-10-02T12:00:00",
    "system": { ... },
    "agents": { ... },
    "github": { ... },
    "resources": { ... },
    "project": { ... }
  }
}
```

### Agent Status
**GET** `/agent/status`

Returns heartbeat agent status.

**Response**:
```json
{
  "success": true,
  "data": {
    "running": true,
    "swarm_id": "test-swarm-001",
    "monitor_url": "https://backend.com/api/v1/heartbeat",
    "interval": 60,
    "github_repo": "owner/repo"
  }
}
```

## Metrics Collected

### System Metrics
- Hostname
- Platform (OS)
- Python version
- Uptime

### Resource Metrics
- CPU usage (%)
- Memory usage (GB and %)
- Disk usage (GB and %)

### Agent Metrics
- Active agents count
- Total agents count
- Individual agent status

### GitHub Metrics
- Open issues count
- Open pull requests count
- Recent commits count

### Project Metrics
- Completion percentage
- Issues by status (open, in progress, blocked, done)
- Issues requiring human intervention
- Estimated completion date
- Velocity trend

## Error Handling

### Network Failures
The heartbeat agent automatically retries failed requests:
- **Max retries**: 3 attempts
- **Retry delay**: 5 seconds between attempts
- **Timeout**: 10 seconds per request

### Local Logging
All metrics are logged locally for debugging:
- **Location**: `logs/heartbeat_YYYYMMDD.json`
- **Format**: JSON lines (one metric per line)
- **Rotation**: Daily rotation by date

### Graceful Degradation
- If the backend is unreachable, the agent continues collecting metrics locally
- The API server continues serving cached metrics even if collection fails
- Missing metrics are returned as empty values rather than errors

## Testing

### Run all tests:
```bash
pytest tests/
```

### Run with coverage:
```bash
pytest --cov=core --cov-report=html tests/
```

### Run specific test file:
```bash
pytest tests/test_heartbeat.py
```

## Monitoring

### Check if agent is running:
```bash
ps aux | grep heartbeat
```

### View recent heartbeat logs:
```bash
tail -f heartbeat.log
```

### View collected metrics:
```bash
cat logs/heartbeat_$(date +%Y%m%d).json | jq
```

### Test API endpoints:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/status
curl http://localhost:8080/project/completion
```

## Troubleshooting

### Agent not sending heartbeats
1. Check `monitor_url` is configured correctly
2. Verify `api_key` is valid
3. Check network connectivity to backend
4. Review `heartbeat.log` for errors

### API server not responding
1. Verify port 8080 is not in use: `netstat -an | grep 8080`
2. Check firewall allows incoming connections
3. Ensure Flask dependencies are installed
4. Try running with `--debug` flag

### High resource usage
1. Increase heartbeat interval in `settings.ini`
2. Reduce concurrent agents
3. Check for memory leaks in agent code
4. Monitor system resources: `htop`

## Security Considerations

- **API Key Protection**: Never commit `settings.ini` with real API keys
- **Network Security**: Use HTTPS for `monitor_url`
- **Access Control**: Restrict API server access via firewall rules
- **Credential Storage**: Store GitHub tokens securely (environment variables)

## Performance

### Resource Usage
- **Memory**: ~50-100 MB
- **CPU**: <5% (mostly idle)
- **Network**: ~1 KB per heartbeat (every 60 seconds)
- **Disk**: ~10 MB per day (local logs)

### Scalability
- Can run on resource-constrained devices (Raspberry Pi)
- Supports hundreds of concurrent API requests
- Minimal impact on QiFlow swarm performance

## Future Enhancements

- [ ] Support for multiple backend endpoints
- [ ] Encrypted metric transmission
- [ ] Compression for large payloads
- [ ] Webhooks for critical alerts
- [ ] Integration with Prometheus/Grafana
- [ ] Automatic GitHub API rate limit management
- [ ] Machine learning for anomaly detection

## Contributing

For bugs or feature requests, please create a GitHub issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Python version)

## License

[Add license information]

## Support

For questions or issues:
- GitHub Issues: [repository-url]/issues
- Documentation: [repository-url]/docs
