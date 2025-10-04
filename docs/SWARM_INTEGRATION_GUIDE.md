# QiFlow Swarm Integration Guide

## Introduction

This guide explains how to integrate QiFlow Control Center with your existing QiFlow swarm deployments. By following these steps, your swarm will send real-time status updates to the central backend and expose local API endpoints for monitoring.

## Overview

QiFlow Control Center integration consists of two components:

1. **Heartbeat Agent** - Sends periodic status updates to central backend
2. **API Server** - Exposes local REST endpoints for direct polling

Both components run alongside your existing QiFlow swarm and have minimal performance impact.

## Prerequisites

- Existing QiFlow swarm deployment
- Python 3.8 or higher
- Network connectivity to central backend
- Port 8080 available (configurable)
- GitHub personal access token (for project tracking)

## Quick Start

### 1. Install Dependencies

```bash
cd /path/to/your/qiflow/swarm
pip install -r requirements.txt
```

Required packages:
- `requests` - HTTP client for heartbeat
- `psutil` - System metrics collection
- `flask` - API server
- `PyGithub` - GitHub API integration

### 2. Configure Settings

Copy the example configuration:

```bash
cp settings.ini.example settings.ini
```

Edit `settings.ini`:

```ini
[heartbeat]
# Central backend URL (provided by administrator)
monitor_url = https://api.qiflow-control.com/api/v1/heartbeat

# Your swarm's unique API key (provided by administrator)
api_key = swarm_abc123_your_key_here

# How often to send heartbeat (seconds)
interval = 60

# Unique identifier for this swarm (leave empty to auto-generate)
swarm_id =

# Enable local API server
enable_api = true

# Port for API server (ensure this is available)
api_port = 8080

[project_tracking]
# Enable GitHub project tracking
enabled = true

# Your GitHub repository (owner/repo format)
github_repo = your-org/your-repo

# GitHub personal access token (read-only is sufficient)
github_token = ghp_your_github_token_here

# Hours before an issue is flagged as blocked
flag_blocked_after_hours = 24

# Number of consecutive failures before flagging
flag_failures_threshold = 3

# Test failure rate threshold (0.10 = 10%)
flag_test_failure_rate = 0.10
```

### 3. Start Components

**Option A: Foreground (for testing)**

```bash
# Terminal 1: Start heartbeat agent
python -m core.heartbeat

# Terminal 2: Start API server
python -m core.api_server
```

**Option B: Background (for production)**

```bash
# Start heartbeat agent in background
nohup python -m core.heartbeat > heartbeat.log 2>&1 &

# Start API server in background
nohup python -m core.api_server > api_server.log 2>&1 &
```

**Option C: Systemd Service (recommended)**

See [Production Deployment](#production-deployment) section below.

### 4. Verify Integration

```bash
# Test local API
curl http://localhost:8080/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-04T12:00:00",
#   "swarm_id": "your-swarm-id"
# }

# Check heartbeat logs
tail -f heartbeat.log

# You should see:
# INFO: Heartbeat sent successfully
# INFO: Response: {'success': True, 'message': 'Heartbeat received'}
```

### 5. Register with Backend

Contact your administrator to register this swarm in the central backend. Provide:
- Swarm name
- Host URL (e.g., `http://your-server.com:8080`)
- GitHub repository
- Customer/project association (if applicable)

Once registered, your swarm will appear in the mobile app dashboard!

## Detailed Configuration

### Heartbeat Settings

**monitor_url**
- Central backend endpoint for heartbeat data
- Format: `https://domain.com/api/v1/heartbeat`
- Ask your administrator for the correct URL

**api_key**
- Authentication token for backend
- Keep this secret and secure
- Rotated periodically by administrator

**interval**
- How often to send heartbeat (seconds)
- Default: 60 seconds
- Range: 30-300 seconds
- Lower = more real-time, higher = less network usage

**swarm_id**
- Unique identifier for this swarm
- Leave empty to auto-generate UUID
- Once generated, don't change it

**enable_api**
- Enable/disable local API server
- Default: `true`
- Set to `false` if you only want heartbeat (no direct polling)

**api_port**
- TCP port for API server
- Default: 8080
- Choose different port if 8080 is in use

### Project Tracking Settings

**enabled**
- Enable/disable GitHub project tracking
- Default: `true`
- Set to `false` for swarms without GitHub integration

**github_repo**
- Repository in `owner/repo` format
- Example: `acme-corp/awesome-project`
- Must match your QiFlow swarm's repository

**github_token**
- Personal access token from GitHub
- Required scopes: `repo:read`, `issues:read`
- Create at: https://github.com/settings/tokens

**flag_blocked_after_hours**
- Hours before flagging issue as blocked
- Default: 24
- Set lower for faster intervention, higher for more patience

**flag_failures_threshold**
- Consecutive CI failures before flagging
- Default: 3
- Prevents flagging on transient failures

**flag_test_failure_rate**
- Test failure rate threshold (0.0-1.0)
- Default: 0.10 (10%)
- Flags if >10% of tests fail

## API Endpoints Reference

Your swarm exposes the following endpoints:

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-04T12:00:00Z",
  "swarm_id": "swarm-abc-123"
}
```

**Usage:**
```bash
curl http://your-swarm:8080/health
```

### GET /status

Current swarm status and metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-abc-123",
    "timestamp": "2025-10-04T12:00:00Z",
    "system": {
      "hostname": "swarm-prod-01",
      "platform": "Linux-5.15.0-x86_64",
      "python_version": "3.11.0"
    },
    "resources": {
      "cpu_percent": 45.2,
      "memory_percent": 62.5,
      "memory_used_gb": 5.0,
      "memory_total_gb": 8.0,
      "disk_percent": 75.0,
      "disk_used_gb": 150.0,
      "disk_total_gb": 200.0
    },
    "agents": {
      "active_agents": 2,
      "total_agents": 3,
      "agent_list": [
        {"name": "Agent-1", "status": "working"},
        {"name": "Agent-2", "status": "idle"}
      ]
    }
  }
}
```

### GET /project/completion

Project completion metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "completion_percentage": 73,
    "total_issues": 68,
    "completed_issues": 45,
    "in_progress_issues": 8,
    "ready_issues": 12,
    "blocked_issues": 3,
    "issues_requiring_human_intervention": [
      {
        "id": 127,
        "title": "Merge conflict in auth module",
        "priority": "critical",
        "blocked_duration_hours": 48
      }
    ],
    "estimated_completion_date": "2025-11-15",
    "velocity_trend": 6.2
  }
}
```

### GET /project/issues

Paginated issue list with filters.

**Query Parameters:**
- `page` (int, default: 1) - Page number
- `limit` (int, default: 20) - Items per page
- `status` (string) - Filter by status: `open`, `closed`, `all`
- `flagged` (boolean) - Show only flagged issues

**Example:**
```bash
curl "http://your-swarm:8080/project/issues?page=1&limit=10&status=open&flagged=true"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": 127,
        "title": "Merge conflict in auth module",
        "state": "open",
        "flagged": true,
        "priority": "critical"
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 3
  }
}
```

### GET /metrics

All collected metrics in one response.

**Response:**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-abc-123",
    "timestamp": "2025-10-04T12:00:00Z",
    "system": { ... },
    "resources": { ... },
    "agents": { ... },
    "github": {
      "open_issues": 15,
      "open_prs": 3,
      "recent_commits": 12
    },
    "project": {
      "completion_percentage": 73,
      "total_issues": 68
    }
  }
}
```

### GET /agent/status

Heartbeat agent configuration and status.

**Response:**
```json
{
  "success": true,
  "data": {
    "running": true,
    "swarm_id": "swarm-abc-123",
    "monitor_url": "https://api.example.com/api/v1/heartbeat",
    "interval": 60,
    "github_repo": "owner/repo",
    "api_port": 8080
  }
}
```

## Production Deployment

### Systemd Service (Linux)

**1. Create Heartbeat Service**

`/etc/systemd/system/qiflow-heartbeat.service`:

```ini
[Unit]
Description=QiFlow Heartbeat Agent
After=network.target

[Service]
Type=simple
User=qiflow
WorkingDirectory=/opt/qiflow/swarm
ExecStart=/usr/bin/python3 -m core.heartbeat
Restart=always
RestartSec=10
StandardOutput=append:/var/log/qiflow/heartbeat.log
StandardError=append:/var/log/qiflow/heartbeat_error.log

[Install]
WantedBy=multi-user.target
```

**2. Create API Server Service**

`/etc/systemd/system/qiflow-api.service`:

```ini
[Unit]
Description=QiFlow API Server
After=network.target

[Service]
Type=simple
User=qiflow
WorkingDirectory=/opt/qiflow/swarm
ExecStart=/usr/bin/python3 -m core.api_server
Restart=always
RestartSec=10
StandardOutput=append:/var/log/qiflow/api_server.log
StandardError=append:/var/log/qiflow/api_server_error.log

[Install]
WantedBy=multi-user.target
```

**3. Enable and Start Services**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable qiflow-heartbeat
sudo systemctl enable qiflow-api

# Start services
sudo systemctl start qiflow-heartbeat
sudo systemctl start qiflow-api

# Check status
sudo systemctl status qiflow-heartbeat
sudo systemctl status qiflow-api

# View logs
sudo journalctl -u qiflow-heartbeat -f
sudo journalctl -u qiflow-api -f
```

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY core/ core/
COPY settings.ini .

# Expose API port
EXPOSE 8080

# Run both services
CMD ["sh", "-c", "python -m core.heartbeat & python -m core.api_server"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  qiflow-swarm:
    build: .
    container_name: qiflow-swarm
    ports:
      - "8080:8080"
    volumes:
      - ./settings.ini:/app/settings.ini:ro
      - ./logs:/app/logs
    restart: unless-stopped
    environment:
      - PYTHONUNBUFFERED=1
```

**Run:**

```bash
docker-compose up -d
docker-compose logs -f
```

## Firewall Configuration

Allow incoming connections to API server:

**UFW (Ubuntu/Debian):**

```bash
sudo ufw allow 8080/tcp
sudo ufw reload
```

**iptables:**

```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

**firewalld (CentOS/RHEL):**

```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## Monitoring & Troubleshooting

### Check if Services are Running

```bash
# Check processes
ps aux | grep heartbeat
ps aux | grep api_server

# Check port is listening
netstat -tuln | grep 8080
# or
ss -tuln | grep 8080
```

### View Logs

```bash
# Heartbeat logs
tail -f heartbeat.log

# API server logs
tail -f api_server.log

# Systemd logs
sudo journalctl -u qiflow-heartbeat -f
sudo journalctl -u qiflow-api -f
```

### Common Issues

#### Heartbeat Not Sending

**Symptoms:**
- No "Heartbeat sent successfully" in logs
- Swarm shows offline in dashboard

**Solutions:**

1. Check network connectivity:
   ```bash
   curl -v https://api.qiflow-control.com/health
   ```

2. Verify API key:
   ```bash
   grep api_key settings.ini
   ```

3. Check monitor_url is correct

4. Review error logs for details

#### API Server Not Responding

**Symptoms:**
- `curl http://localhost:8080/health` fails
- Connection refused errors

**Solutions:**

1. Verify port 8080 is not in use:
   ```bash
   netstat -tuln | grep 8080
   ```

2. Check firewall allows port 8080

3. Verify API server is running:
   ```bash
   ps aux | grep api_server
   ```

4. Check logs for startup errors

#### High Resource Usage

**Symptoms:**
- High CPU/memory usage
- System slowdown

**Solutions:**

1. Increase heartbeat interval:
   ```ini
   [heartbeat]
   interval = 120  # Increase from 60 to 120 seconds
   ```

2. Disable project tracking if not needed:
   ```ini
   [project_tracking]
   enabled = false
   ```

3. Check for memory leaks:
   ```bash
   ps aux --sort=-%mem | head
   ```

#### GitHub API Rate Limiting

**Symptoms:**
- "API rate limit exceeded" in logs
- Missing GitHub metrics

**Solutions:**

1. Use authenticated requests (requires token)
2. Reduce polling frequency
3. Check rate limit status:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/rate_limit
   ```

### Testing Integration

**Manual Test Script:**

```bash
#!/bin/bash
# test_integration.sh

SWARM_HOST="http://localhost:8080"

echo "Testing health endpoint..."
curl -s "$SWARM_HOST/health" | jq .

echo -e "\nTesting status endpoint..."
curl -s "$SWARM_HOST/status" | jq .

echo -e "\nTesting completion endpoint..."
curl -s "$SWARM_HOST/project/completion" | jq .

echo -e "\nTesting metrics endpoint..."
curl -s "$SWARM_HOST/metrics" | jq .

echo -e "\nAll tests complete!"
```

Run:
```bash
chmod +x test_integration.sh
./test_integration.sh
```

## Security Considerations

### API Key Protection

- **Never commit** `settings.ini` to version control
- Store in environment variables for extra security:
  ```bash
  export QIFLOW_API_KEY="your-key-here"
  ```

- Rotate keys periodically (contact administrator)

### GitHub Token Security

- Use **read-only** personal access token
- Minimum scopes: `repo:read`, `issues:read`
- Store in environment variable:
  ```bash
  export GITHUB_TOKEN="ghp_your_token_here"
  ```

### Network Security

- Use **HTTPS** for monitor_url (not HTTP)
- Restrict API server access via firewall
- Consider VPN for swarm-to-backend communication

### Access Control

- Run services as dedicated user (not root):
  ```bash
  sudo useradd -r -s /bin/false qiflow
  sudo chown -R qiflow:qiflow /opt/qiflow
  ```

## Advanced Configuration

### Custom Metrics

Extend `core/metrics_collector.py` to collect custom metrics:

```python
class CustomMetricsCollector(MetricsCollector):
    def collect_custom_metrics(self):
        return {
            'custom_metric_1': self.get_custom_value_1(),
            'custom_metric_2': self.get_custom_value_2()
        }

    def collect_all(self):
        metrics = super().collect_all()
        metrics['custom'] = self.collect_custom_metrics()
        return metrics
```

### Webhook Integration

Receive real-time commands from backend:

```python
# core/webhook_handler.py
from flask import request, jsonify

@app.route('/webhook/command', methods=['POST'])
def handle_command():
    command = request.json.get('command')
    if command == 'pause':
        # Pause swarm logic
        return jsonify({'success': True})
    elif command == 'resume':
        # Resume swarm logic
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'Unknown command'})
```

### Multi-Swarm Management

Run multiple swarms on one host using different ports:

```ini
# Swarm 1: settings_swarm1.ini
[heartbeat]
api_port = 8080

# Swarm 2: settings_swarm2.ini
[heartbeat]
api_port = 8081

# Swarm 3: settings_swarm3.ini
[heartbeat]
api_port = 8082
```

Start with custom config:

```bash
python -m core.api_server --config settings_swarm1.ini --port 8080 &
python -m core.api_server --config settings_swarm2.ini --port 8081 &
python -m core.api_server --config settings_swarm3.ini --port 8082 &
```

## Updating Components

### Pulling Latest Changes

```bash
cd /opt/qiflow/swarm
git pull origin main

# Install new dependencies
pip install -r requirements.txt

# Restart services
sudo systemctl restart qiflow-heartbeat
sudo systemctl restart qiflow-api
```

### Zero-Downtime Updates

```bash
# Start new API server on different port
python -m core.api_server --port 8081 &

# Update load balancer to point to 8081
# ... load balancer config ...

# Stop old API server
pkill -f "api_server.*8080"
```

## Support

### Getting Help

- **Documentation**: Check other guides (User, Admin, Developer)
- **Logs**: Always include relevant logs when reporting issues
- **GitHub Issues**: https://github.com/your-org/QiFlowGo/issues
- **Administrator**: Contact your QiFlow Control Center administrator

### Reporting Integration Issues

Include the following information:

1. Swarm ID
2. Host OS and Python version
3. Relevant log excerpts
4. Steps to reproduce
5. Expected vs actual behavior

---

**Version**: 1.0
**Last Updated**: 2025-10-04
