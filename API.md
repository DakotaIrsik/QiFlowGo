# QiFlow Control Center - Backend API Documentation

## Table of Contents

1. [Health Check Endpoints](#health-check-endpoints)
2. [Human Intervention Flagging System](#human-intervention-flagging-system)
3. [Swarm Management](#swarm-management)
4. [Velocity Metrics](#velocity-metrics)
5. [Deployment Wizard](#deployment-wizard)
6. [Host Management](#host-management)

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication

Authentication will be implemented in a future update. Currently, all endpoints are open for development.

---

## Health Check Endpoints

The API provides multiple health check endpoints for monitoring and orchestration.

### 1. Basic Health Check

Simple health check endpoint for quick status verification.

**Endpoint:** `GET /health`

**Example Request:**
```bash
curl http://localhost:3000/health
```

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "service": "QiFlow Control Center API"
}
```

---

### 2. Detailed Health Check

Comprehensive health check with database connectivity, memory usage, and service metrics.

**Endpoint:** `GET /health/detailed`

**Example Request:**
```bash
curl http://localhost:3000/health/detailed
```

**Example Response (Healthy):**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "service": "QiFlow Control Center API",
  "version": "1.0.0",
  "uptime": {
    "seconds": 3665,
    "human": "1h 1m 5s"
  },
  "checks": {
    "database": {
      "status": "ok",
      "responseTime": 15
    },
    "memory": {
      "status": "ok",
      "usage": {
        "rss": 128,
        "heapTotal": 64,
        "heapUsed": 32,
        "external": 2
      }
    },
    "process": {
      "status": "ok",
      "pid": 12345
    }
  },
  "responseTime": 20
}
```

**Example Response (Unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "service": "QiFlow Control Center API",
  "version": "1.0.0",
  "uptime": {
    "seconds": 120,
    "human": "2m"
  },
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection refused",
      "responseTime": 0
    },
    "memory": {
      "status": "ok",
      "usage": {
        "rss": 128,
        "heapTotal": 64,
        "heapUsed": 32,
        "external": 2
      }
    },
    "process": {
      "status": "ok",
      "pid": 12345
    }
  },
  "responseTime": 5
}
```

**HTTP Status Codes:**
- `200` - Service is healthy
- `503` - Service is unhealthy (database connection failed)

**Status Values:**
- `ok` - All checks passing
- `degraded` - Service operational but with performance issues
- `unhealthy` - Critical service components failing

---

### 3. Liveness Probe

Kubernetes-style liveness probe for container orchestration.

**Endpoint:** `GET /health/live`

**Example Request:**
```bash
curl http://localhost:3000/health/live
```

**Example Response:**
```
OK
```

**HTTP Status Codes:**
- `200` - Server process is running

**Use Case:** Container orchestration platforms (Kubernetes, Docker Swarm) use this to determine if the container should be restarted.

---

### 4. Readiness Probe

Kubernetes-style readiness probe that checks if the service is ready to accept traffic.

**Endpoint:** `GET /health/ready`

**Example Request:**
```bash
curl http://localhost:3000/health/ready
```

**Example Response (Ready):**
```
READY
```

**Example Response (Not Ready):**
```
NOT READY
```

**HTTP Status Codes:**
- `200` - Service is ready to accept traffic (database connected)
- `503` - Service is not ready (database not available)

**Use Case:** Container orchestration platforms use this to determine if traffic should be routed to this instance.

---

## Human Intervention Flagging System

This API provides endpoints for managing intervention flags that alert when issues require human attention.

## Endpoints

### 1. List Intervention Flags

Get all intervention flags for a swarm with optional filtering.

**Endpoint:** `GET /swarms/:swarm_id/interventions`

**Query Parameters:**
- `priority` (optional): Filter by priority (`critical` or `review`)
- `resolved` (optional): Filter by resolution status (`true` or `false`)
- `limit` (optional): Maximum number of results (default: all)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1/interventions?resolved=false&priority=critical
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "swarm_id": "swarm-1",
      "issue_number": 127,
      "github_url": "https://github.com/owner/repo/issues/127",
      "priority": "critical",
      "reason": "Agent failed 3 consecutive times",
      "trigger_type": "agent_failure",
      "agent_message": "Build failed: missing dependency",
      "failure_count": 3,
      "flagged_at": "2025-10-02T10:30:00Z",
      "resolved_at": null,
      "resolved_by": null,
      "resolution_note": null
    }
  ],
  "count": 1
}
```

---

### 2. Count Intervention Flags

Get count of unresolved flags by priority.

**Endpoint:** `GET /swarms/:swarm_id/interventions/count`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1/interventions/count
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "critical": 2,
    "review": 5,
    "total": 7
  }
}
```

---

### 3. Manually Flag Issue

Create a manual intervention flag for an issue.

**Endpoint:** `POST /swarms/:swarm_id/issues/:issue_id/flag`

**Request Body:**
```json
{
  "priority": "critical",
  "reason": "Requires manual code review",
  "note": "Security-sensitive changes detected",
  "github_url": "https://github.com/owner/repo/issues/123"
}
```

**Fields:**
- `priority` (required): `critical` or `review`
- `reason` (required): Reason for flagging
- `note` (optional): Additional notes
- `github_url` (optional): Link to GitHub issue

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms/swarm-1/issues/123/flag \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "review",
    "reason": "Requires manual testing"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "swarm_id": "swarm-1",
    "issue_number": 123,
    "priority": "review",
    "reason": "Requires manual testing",
    "trigger_type": "manual",
    "flagged_at": "2025-10-02T11:00:00Z"
  }
}
```

---

### 4. Resolve Intervention Flag

Mark an intervention flag as resolved.

**Endpoint:** `PUT /swarms/:swarm_id/interventions/:flag_id/resolve`

**Request Body:**
```json
{
  "resolved_by": "john.doe@example.com",
  "resolution_note": "Issue fixed manually and deployed"
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/swarms/swarm-1/interventions/5/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolved_by": "john.doe@example.com",
    "resolution_note": "Fixed merge conflict manually"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "resolved_at": "2025-10-02T11:30:00Z",
    "resolved_by": "john.doe@example.com",
    "resolution_note": "Fixed merge conflict manually"
  }
}
```

---

### 5. Delete/Unflag Issue

Remove an intervention flag.

**Endpoint:** `DELETE /swarms/:swarm_id/issues/:issue_id/flag/:flag_id`

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/v1/swarms/swarm-1/issues/123/flag/5
```

**Example Response:**
```json
{
  "success": true,
  "message": "Flag deleted successfully"
}
```

---

### 6. Bulk Resolve Flags

Resolve multiple intervention flags at once.

**Endpoint:** `POST /swarms/:swarm_id/interventions/bulk-resolve`

**Request Body:**
```json
{
  "flag_ids": [1, 2, 3],
  "resolved_by": "john.doe@example.com",
  "resolution_note": "Batch resolved after sprint review"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms/swarm-1/interventions/bulk-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "flag_ids": [1, 2, 3],
    "resolved_by": "john.doe@example.com"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "resolved_count": 3
  }
}
```

---

## Automatic Flagging Triggers

The system automatically creates intervention flags based on these criteria:

### 1. Blocked Duration
- **Trigger:** Issue in "blocked" status for >24 hours
- **Priority:** `review`
- **Check Frequency:** Hourly cron job

### 2. Agent Failure
- **Trigger:** Agent fails 3+ consecutive times on same issue
- **Priority:** `critical`
- **Check Frequency:** On each agent run completion

### 3. Security Vulnerability
- **Trigger:** Security scanning detects vulnerability
- **Priority:** `critical`
- **Check Frequency:** On code analysis completion

### 4. Test Failure Rate
- **Trigger:** Test failure rate >10% for issue branch
- **Priority:** `review`
- **Check Frequency:** On test run completion

### 5. Merge Conflict
- **Trigger:** Agent unable to resolve merge conflict
- **Priority:** `critical`
- **Check Frequency:** On merge attempt failure

### 6. Manual Flagging
- **Trigger:** User manually flags via API
- **Priority:** User-defined
- **Check Frequency:** On-demand

---

## Database Schema

### intervention_flags Table

```sql
CREATE TABLE intervention_flags (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  github_url TEXT,
  priority VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  agent_message TEXT,
  blocked_duration_hours INT,
  failure_count INT,
  flagged_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_note TEXT,
  metadata JSONB,
  UNIQUE(swarm_id, issue_number, trigger_type)
);
```

---

## Setup

### 1. Database Setup

Create PostgreSQL database and run schema:

```bash
# Create database
createdb qiflow_control_center

# Run schema
psql qiflow_control_center < src/database/schema.sql
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Server starts on http://localhost:3000

### 5. Run Tests

```bash
npm test
```

---

## Integration Example

Here's how to integrate the flagging service in your agent code:

```typescript
import { FlaggingService } from './services/flaggingService';

// When agent run completes
async function handleAgentCompletion(agentRun) {
  await FlaggingService.onAgentRunComplete(
    agentRun.swarm_id,
    agentRun.issue_number,
    agentRun.status, // 'success' or 'failed'
    agentRun.agent_name,
    agentRun.error_message,
    agentRun.github_url
  );
}

// When merge conflict occurs
async function handleMergeConflict(swarmId, issueNumber, files, error) {
  await FlaggingService.flagMergeConflict(
    swarmId,
    issueNumber,
    files,
    error,
    githubUrl
  );
}

// When issue status changes
async function handleStatusChange(swarmId, issueNumber, newStatus) {
  await FlaggingService.trackIssueStatusChange(
    swarmId,
    issueNumber,
    newStatus
  );
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Swarm Management API

### Base URL

```
http://localhost:3000/api/v1
```

### 7. List All Swarms

Get all registered swarms with their current status. Response is cached for 30 seconds.

**Endpoint:** `GET /swarms`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "swarm_id": "swarm-1",
      "name": "Production Swarm",
      "host_url": "http://192.168.1.100:8080",
      "status": "online",
      "last_seen": "2025-10-02T15:45:00Z",
      "health_status": {
        "cpu_percent": 45.2,
        "memory_percent": 67.8,
        "disk_percent": 34.1
      },
      "active_agents": 5,
      "project_completion": 73.5,
      "created_at": "2025-09-15T10:00:00Z",
      "updated_at": "2025-10-02T15:45:00Z"
    }
  ],
  "cached": false
}
```

---

### 8. Get Swarm Details

Get detailed status for a specific swarm. Response is cached for 15 seconds.

**Endpoint:** `GET /swarms/:swarm_id`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-1",
    "name": "Production Swarm",
    "host_url": "http://192.168.1.100:8080",
    "status": "online",
    "last_seen": "2025-10-02T15:45:00Z",
    "health_status": {
      "cpu_percent": 45.2,
      "memory_percent": 67.8,
      "disk_percent": 34.1
    },
    "active_agents": 5,
    "project_completion": 73.5,
    "created_at": "2025-09-15T10:00:00Z",
    "updated_at": "2025-10-02T15:45:00Z"
  },
  "cached": true
}
```

---

### 9. Get Swarm Status (Lightweight)

Get lightweight status for a specific swarm (no heavy data). Response is cached for 15 seconds.

**Endpoint:** `GET /swarms/:swarm_id/status`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1/status
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-1",
    "status": "online",
    "last_seen": "2025-10-02T15:45:00Z"
  },
  "cached": false
}
```

---

### 10. Register New Swarm

Register a new swarm with the monitoring system.

**Endpoint:** `POST /swarms`

**Request Body:**
```json
{
  "swarm_id": "swarm-2",
  "name": "Development Swarm",
  "host_url": "http://192.168.1.101:8080"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms \
  -H "Content-Type: application/json" \
  -d '{"swarm_id":"swarm-2","name":"Development Swarm","host_url":"http://192.168.1.101:8080"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-2",
    "name": "Development Swarm",
    "host_url": "http://192.168.1.101:8080",
    "status": "offline",
    "last_seen": "2025-10-02T15:50:00Z",
    "health_status": null,
    "active_agents": 0,
    "project_completion": null,
    "created_at": "2025-10-02T15:50:00Z",
    "updated_at": "2025-10-02T15:50:00Z"
  }
}
```

---

### 11. Unregister Swarm

Remove a swarm from the monitoring system.

**Endpoint:** `DELETE /swarms/:swarm_id`

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/v1/swarms/swarm-2
```

**Example Response:**
```json
{
  "success": true,
  "message": "Swarm deleted successfully"
}
```

---

### 12. Force Cache Refresh

Invalidate all swarm caches to force fresh data on next request.

**Endpoint:** `POST /swarms/refresh`

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms/refresh
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cache invalidated successfully"
}
```

---

## Polling Architecture

### Background Polling Service

The backend runs a continuous polling service (`swarmPollingService`) that:

- Polls all registered swarm hosts every **30 seconds**
- Fetches `/status` and `/project/completion` endpoints from each swarm
- Updates the database with latest metrics
- Marks swarms as **offline** if not seen for >60 seconds
- Uses parallel requests with 5-second timeout per swarm

### Mobile App Polling

Mobile apps should poll the central backend with these intervals:

- **Dashboard view**: Poll `GET /swarms` every 30 seconds
- **Detail view**: Poll `GET /swarms/:id` every 15 seconds
- **Background**: Pause polling when app is backgrounded
- **Manual refresh**: Use `POST /swarms/refresh` for pull-to-refresh

### Caching Strategy

- **List endpoint** (`/swarms`): 30-second cache TTL
- **Detail endpoint** (`/swarms/:id`): 15-second cache TTL
- **Status endpoint** (`/swarms/:id/status`): 15-second cache TTL
- Cache invalidation on: swarm creation, deletion, manual refresh
- Cached responses include `"cached": true` indicator

---

## Velocity Tracking & Forecasting API

### 13. Get Velocity Metrics

Calculate rolling velocity for a swarm with trend analysis.

**Endpoint:** `GET /swarms/:swarm_id/velocity`

**Query Parameters:**
- `days` (optional): Rolling window in days (default: 7, max: 90)

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1/velocity?days=7
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "issues_per_day": 6.2,
    "last_n_days": [5, 8, 7, 6, 4, 9, 7],
    "period_days": 7,
    "period_start": "2025-09-25",
    "period_end": "2025-10-02",
    "trend": "stable",
    "trend_percentage": 2.3,
    "slope": 0.1
  },
  "cached": false
}
```

**Trend Values:**
- `increasing`: Velocity growing by >10%
- `stable`: Velocity within ±10%
- `decreasing`: Velocity dropping by >10%

---

### 14. Get Completion Forecast

Get estimated completion date and forecast for a swarm's project.

**Endpoint:** `GET /swarms/:swarm_id/forecast`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1/forecast
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "estimated_completion_date": "2025-11-15",
    "days_remaining": 44,
    "confidence_level": 0.95,
    "confidence_label": "High",
    "based_on_velocity": 6.2,
    "remaining_issues": 58,
    "last_updated": "2025-10-02T15:30:00Z"
  },
  "cached": false
}
```

**Confidence Labels:**
- `High` (0.85-1.0): Very consistent velocity
- `Medium` (0.65-0.85): Moderate velocity variance
- `Low` (0.0-0.65): High velocity variance or insufficient data

---

### 15. Get Historical Velocity Metrics

Get historical velocity metrics for a date range.

**Endpoint:** `GET /swarms/:swarm_id/velocity/history`

**Query Parameters:**
- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/swarms/swarm-1/velocity/history?start_date=2025-09-01&end_date=2025-10-01"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "date": "2025-10-01",
        "issues_closed": 7,
        "issues_opened": 5,
        "net_progress": 2,
        "avg_completion_time_hours": 36.2
      },
      {
        "date": "2025-09-30",
        "issues_closed": 6,
        "issues_opened": 4,
        "net_progress": 2,
        "avg_completion_time_hours": 42.1
      }
    ]
  },
  "cached": false
}
```

---

### 16. Record Issue Completion

Record when an issue is completed (for velocity tracking).

**Endpoint:** `POST /swarms/:swarm_id/completions`

**Request Body:**
```json
{
  "issue_number": 42,
  "closed_at": "2025-10-02T10:30:00Z",
  "time_to_complete_hours": 48.5,
  "assigned_agent": "Agent-1"
}
```

**Fields:**
- `issue_number` (required): GitHub issue number
- `closed_at` (optional): ISO timestamp (defaults to current time)
- `time_to_complete_hours` (optional): Time taken to complete
- `assigned_agent` (optional): Agent that completed the issue

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms/swarm-1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "issue_number": 42,
    "time_to_complete_hours": 48.5,
    "assigned_agent": "Agent-1"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "swarm_id": "swarm-1",
    "issue_number": 42,
    "closed_at": "2025-10-02T10:30:00Z",
    "time_to_complete_hours": 48.5,
    "assigned_agent": "Agent-1",
    "created_at": "2025-10-02T10:30:00Z"
  }
}
```

---

### 17. Trigger Daily Aggregation

Manually trigger daily metric aggregation for a specific date.

**Endpoint:** `POST /velocity/aggregate`

**Request Body:**
```json
{
  "date": "2025-10-01"
}
```

**Fields:**
- `date` (optional): Date in YYYY-MM-DD format (defaults to yesterday)

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/velocity/aggregate \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-10-01"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Daily metrics aggregated for 2025-10-01"
}
```

---

## Velocity Tracking Features

### How Velocity is Calculated

The system tracks project velocity using a rolling average:
- **Default window**: 7 days
- **Configurable**: Up to 90 days
- **Metric**: Issues closed per day
- **Formula**: Total issues closed / number of days

### Trend Detection Algorithm

Uses linear regression to detect velocity trends:
- Calculates slope of velocity over time
- Converts slope to percentage relative to mean
- **Increasing**: >10% trend (team getting faster)
- **Stable**: ±10% trend (predictable pace)
- **Decreasing**: <-10% trend (team slowing down)

### Completion Forecasting

Estimates project completion using:
1. **Current velocity**: Issues per day over last 7 days
2. **Remaining work**: Total issues - completed issues
3. **Base estimate**: Remaining issues / velocity
4. **Trend adjustment**: Adjusts estimate based on velocity trend
5. **Confidence level**: Based on velocity variance (CV coefficient)

### Daily Aggregation

Background job runs daily to:
- Aggregate issue completions by date
- Calculate average completion times
- Track issues opened vs closed
- Compute net progress per day

**Cron Schedule**: Midnight daily (0 0 * * *)

---

## Database Schema

### velocity_metrics Table

```sql
CREATE TABLE velocity_metrics (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  issues_closed INT DEFAULT 0,
  issues_opened INT DEFAULT 0,
  net_progress INT DEFAULT 0,
  avg_completion_time_hours DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(swarm_id, date)
);

CREATE INDEX idx_velocity_swarm_date ON velocity_metrics(swarm_id, date DESC);
```

### issue_completions Table

```sql
CREATE TABLE issue_completions (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  closed_at TIMESTAMP NOT NULL,
  time_to_complete_hours DECIMAL(10,2),
  assigned_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_completions_swarm ON issue_completions(swarm_id, closed_at DESC);
```

---

## Future Enhancements

**Intervention System:**
- Push notifications when flags are created
- Email notifications for critical flags
- Slack/Discord integration
- Custom flagging rules engine
- Machine learning-based priority prediction
- Integration with GitHub webhooks

**Swarm Management:**
- WebSocket support for real-time updates (eliminate polling)
- Rate limiting per swarm (100 req/min)
- Swarm control actions (pause, resume, restart)
- Alerting system for offline swarms

**Velocity & Forecasting:**
- GitHub webhook integration for automatic completion tracking
- Sprint burndown charts
- Team member velocity breakdown
- Issue complexity weighting
- Multi-swarm velocity aggregation
- Machine learning-based forecast refinement
- Historical velocity data export (CSV/JSON)
- Comparison across multiple swarms
