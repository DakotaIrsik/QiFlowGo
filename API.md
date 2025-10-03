# QiFlow Control Center - Backend API Documentation

## Human Intervention Flagging System

This API provides endpoints for managing intervention flags that alert when issues require human attention.

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication

All API endpoints (except `/health`) require authentication via API key.

**Header Format:**
```
Authorization: Bearer <your-api-key>
```
or
```
Authorization: ApiKey <your-api-key>
```

**Example:**
```bash
curl http://localhost:3000/api/v1/swarms \
  -H "Authorization: Bearer your-api-key-here"
```

**Configuration:**
Set the `API_KEY_SECRET` environment variable in your `.env` file:
```
API_KEY_SECRET=your-secure-api-key
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid API key
- `500 Internal Server Error`: Server configuration error (API_KEY_SECRET not set)

---

### Rate Limiting

All API routes are protected by rate limiting to prevent abuse.

**General API Endpoints:**
- **Limit**: 100 requests per 15 minutes per IP
- **Applies to**: GET requests and general operations

**Write Operations (POST/PUT/DELETE):**
- **Limit**: 20 requests per 15 minutes per IP (future enhancement)
- **Applies to**: Create, update, and delete operations

**Command Execution:**
- **Limit**: 10 executions per 5 minutes per IP (future enhancement)
- **Applies to**: SSH command execution endpoints

**Rate Limit Headers:**
All responses include rate limit information:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1696262400
```

**Error Response (429 Too Many Requests):**
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Monitoring API Endpoints

### 1. Send Heartbeat

Receive heartbeat data from swarm deployments and update swarm status.

**Endpoint:** `POST /heartbeat`

**Request Body:**
```json
{
  "swarm_id": "swarm-1",
  "status": "online",
  "health_status": {
    "cpu_percent": 45.5,
    "memory_percent": 60.2,
    "disk_percent": 30.1
  },
  "active_agents": 5,
  "project_completion": 75
}
```

**Parameters:**
- `swarm_id` (required): Unique identifier for the swarm
- `status` (optional): Status of the swarm (`online`, `offline`, `degraded`). Defaults to `online`
- `health_status` (optional): Object containing health metrics
  - `cpu_percent`: CPU usage percentage
  - `memory_percent`: Memory usage percentage
  - `disk_percent`: Disk usage percentage
- `active_agents` (optional): Number of currently active agents
- `project_completion` (optional): Project completion percentage

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/heartbeat \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "swarm_id": "swarm-1",
    "status": "online",
    "health_status": {
      "cpu_percent": 45.5,
      "memory_percent": 60.2,
      "disk_percent": 30.1
    },
    "active_agents": 5,
    "project_completion": 75
  }'
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": {
    "swarm_id": "swarm-1",
    "name": "Production Swarm",
    "host_url": "http://192.168.1.100:8000",
    "status": "online",
    "last_seen": "2025-10-02T10:30:00.000Z",
    "health_status": {
      "cpu_percent": 45.5,
      "memory_percent": 60.2,
      "disk_percent": 30.1
    },
    "active_agents": 5,
    "project_completion": 75,
    "created_at": "2025-10-01T08:00:00.000Z",
    "updated_at": "2025-10-02T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing swarm_id or invalid health_status format
- `404 Not Found`: Swarm not found (must be registered first)
- `401 Unauthorized`: Invalid API key
- `500 Internal Server Error`: Server error

---

### 2. List All Swarms

Get a list of all registered swarms with their current status.

**Endpoint:** `GET /swarms`

**Caching:** Results are cached for 30 seconds

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms \
  -H "Authorization: Bearer your-api-key-here"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "swarm_id": "swarm-1",
      "name": "Production Swarm",
      "host_url": "http://192.168.1.100:8000",
      "status": "online",
      "last_seen": "2025-10-02T10:30:00.000Z",
      "health_status": {
        "cpu_percent": 45.5,
        "memory_percent": 60.2,
        "disk_percent": 30.1
      },
      "active_agents": 5,
      "project_completion": 75,
      "created_at": "2025-10-01T08:00:00.000Z",
      "updated_at": "2025-10-02T10:30:00.000Z"
    }
  ],
  "cached": false
}
```

---

### 3. Get Swarm Details

Get detailed information about a specific swarm.

**Endpoint:** `GET /swarms/:swarm_id`

**Caching:** Results are cached for 15 seconds

**Example Request:**
```bash
curl http://localhost:3000/api/v1/swarms/swarm-1 \
  -H "Authorization: Bearer your-api-key-here"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "swarm_id": "swarm-1",
    "name": "Production Swarm",
    "host_url": "http://192.168.1.100:8000",
    "status": "online",
    "last_seen": "2025-10-02T10:30:00.000Z",
    "health_status": {
      "cpu_percent": 45.5,
      "memory_percent": 60.2,
      "disk_percent": 30.1
    },
    "active_agents": 5,
    "project_completion": 75,
    "created_at": "2025-10-01T08:00:00.000Z",
    "updated_at": "2025-10-02T10:30:00.000Z"
  },
  "cached": false
}
```

**Error Responses:**
- `404 Not Found`: Swarm not found
- `401 Unauthorized`: Invalid API key
- `500 Internal Server Error`: Server error

---

### 4. Control Swarm

Execute control actions on a swarm deployment.

**Endpoint:** `POST /swarms/:swarm_id/control`

**Request Body:**
```json
{
  "action": "restart",
  "parameters": {
    "timeout": 30
  }
}
```

**Parameters:**
- `action` (required): Control action to execute
  - `start`: Start the swarm
  - `stop`: Stop the swarm
  - `restart`: Restart the swarm
  - `update`: Update the swarm
  - `config`: Update swarm configuration
- `parameters` (optional): Action-specific parameters

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/swarms/swarm-1/control \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "restart",
    "parameters": {
      "timeout": 30
    }
  }'
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Control action 'restart' queued for swarm swarm-1",
  "data": {
    "swarm_id": "swarm-1",
    "action": "restart",
    "parameters": {
      "timeout": 30
    },
    "status": "queued",
    "queued_at": "2025-10-02T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing action or invalid action type
- `404 Not Found`: Swarm not found
- `401 Unauthorized`: Invalid API key
- `500 Internal Server Error`: Server error

**Audit Logging:**
All control actions are logged for audit purposes with timestamp and parameters.

---

## Heartbeat Monitoring System

### Automatic Offline Detection

The system automatically monitors swarm heartbeats and marks swarms as offline if they haven't sent a heartbeat in 90 seconds.

**Monitoring Service:**
- Checks every 30 seconds
- Heartbeat timeout: 90 seconds
- Triggers push notifications when swarms go offline

**Alert Notification:**
When a swarm misses its heartbeat, a notification is sent:
```json
{
  "title": "Swarm Offline Alert",
  "message": "⚠️ Swarm \"Production Swarm\" (swarm-1) has missed its heartbeat. Last seen 95s ago.",
  "data": {
    "type": "heartbeat_missed",
    "swarm_id": "swarm-1",
    "swarm_name": "Production Swarm",
    "last_seen": 95
  }
}
```

---

## Intervention Flagging System Endpoints

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

## Swarm Deployment Wizard API

### Base URL

```
http://localhost:3000/api/v1
```

### 18. Create Deployment Draft

Initialize a new deployment wizard session.

**Endpoint:** `POST /deployments`

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/deployments \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "created_at": "2025-10-02T16:00:00Z"
  }
}
```

---

### 19. Select Host (Step 1)

Select target host for deployment with capacity validation.

**Endpoint:** `PUT /deployments/:deployment_id/step1`

**Request Body:**
```json
{
  "host_id": "host-123"
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/deployments/deploy-abc123/step1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"host_id": "host-123"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "host_id": "host-123"
  }
}
```

---

### 20. Configure GitHub Repository (Step 2)

Configure GitHub repository for the swarm.

**Endpoint:** `PUT /deployments/:deployment_id/step2`

**Request Body:**
```json
{
  "github_repo": "my-project",
  "github_owner": "myorganization",
  "github_token": "ghp_xxxxxxxxxxxx"
}
```

**Fields:**
- `github_repo` (required): Repository name
- `github_owner` (required): Repository owner/organization
- `github_token` (optional): GitHub personal access token

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/deployments/deploy-abc123/step2 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "github_repo": "my-project",
    "github_owner": "myorganization"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "github_repo": "my-project",
    "github_owner": "myorganization"
  }
}
```

---

### 21. Set Schedule (Step 3)

Configure swarm execution schedule using presets or custom cron.

**Endpoint:** `PUT /deployments/:deployment_id/step3`

**Request Body (Preset):**
```json
{
  "schedule_preset": "business_hours"
}
```

**Request Body (Custom):**
```json
{
  "schedule_preset": "custom",
  "cron_expression": "0 9-17 * * 1-5"
}
```

**Schedule Presets:**
- `continuous`: 24/7 operation (`* * * * *`)
- `business_hours`: 9 AM - 6 PM, Mon-Fri (`0 9-18 * * 1-5`)
- `nightly`: 10 PM - 6 AM (`0 22-6 * * *`)
- `custom`: User-defined cron expression

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/deployments/deploy-abc123/step3 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"schedule_preset": "continuous"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "schedule_preset": "continuous",
    "cron_expression": "* * * * *"
  }
}
```

---

### 22. Configure Agents (Step 4)

Define agent roles and responsibilities for the swarm.

**Endpoint:** `PUT /deployments/:deployment_id/step4`

**Request Body:**
```json
{
  "agents": [
    {
      "role": "Backend Developer",
      "responsibilities": ["API development", "Database design", "Testing"]
    },
    {
      "role": "Frontend Developer",
      "responsibilities": ["UI components", "State management", "Styling"]
    }
  ]
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/deployments/deploy-abc123/step4 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "agents": [
      {
        "role": "Full Stack Developer",
        "responsibilities": ["Feature implementation", "Bug fixes", "Testing"]
      }
    ]
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "agents": [
      {
        "role": "Full Stack Developer",
        "responsibilities": ["Feature implementation", "Bug fixes", "Testing"]
      }
    ]
  }
}
```

---

### 23. Set Customer/Billing Info (Step 5)

Configure customer and project details for billing.

**Endpoint:** `PUT /deployments/:deployment_id/step5`

**Request Body:**
```json
{
  "customer_name": "Acme Corporation",
  "project_name": "E-commerce Platform",
  "customer_id": "cust-456",
  "billing_rate": 150.00
}
```

**Fields:**
- `customer_name` (required): Customer name
- `project_name` (required): Project name
- `customer_id` (optional): External customer ID
- `billing_rate` (optional): Hourly billing rate

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/deployments/deploy-abc123/step5 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "customer_name": "Acme Corporation",
    "project_name": "E-commerce Platform"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "draft",
    "customer_name": "Acme Corporation",
    "project_name": "E-commerce Platform"
  }
}
```

---

### 24. Execute Deployment

Execute the deployment to the selected host via SSH.

**Endpoint:** `POST /deployments/:deployment_id/deploy`

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/deployments/deploy-abc123/deploy \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Deployment started",
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "deploying"
  }
}
```

---

### 25. Get Deployment Progress

Monitor real-time deployment progress.

**Endpoint:** `GET /deployments/:deployment_id/progress`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/deployments/deploy-abc123/progress \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "deploying",
    "current_step": "Installing dependencies",
    "progress_percent": 60,
    "logs": [
      "Connecting to host...",
      "Creating deployment directory...",
      "Cloning repository...",
      "Installing Python dependencies...",
      "Configuring settings.ini..."
    ]
  }
}
```

**Status Values:**
- `deploying`: Deployment in progress
- `deployed`: Successfully deployed
- `failed`: Deployment failed

---

### 26. Get Deployment Configuration

Retrieve full deployment configuration.

**Endpoint:** `GET /deployments/:deployment_id`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/deployments/deploy-abc123 \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deployment_id": "deploy-abc123",
    "status": "deployed",
    "host_id": "host-123",
    "github_repo": "my-project",
    "github_owner": "myorganization",
    "schedule_preset": "continuous",
    "agents": [
      {
        "role": "Full Stack Developer",
        "responsibilities": ["Feature implementation", "Bug fixes"]
      }
    ],
    "customer_name": "Acme Corporation",
    "project_name": "E-commerce Platform",
    "created_at": "2025-10-02T16:00:00Z",
    "updated_at": "2025-10-02T16:15:00Z"
  }
}
```

---

### 27. Get Schedule Presets

List available schedule presets.

**Endpoint:** `GET /deployments/schedule-presets`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/deployments/schedule-presets \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "continuous": {
      "name": "Continuous",
      "description": "Run swarm continuously, 24/7",
      "cron_expression": "* * * * *"
    },
    "business_hours": {
      "name": "Business Hours",
      "description": "Run during business hours (9 AM - 6 PM, Mon-Fri)",
      "cron_expression": "0 9-18 * * 1-5"
    },
    "nightly": {
      "name": "Nightly",
      "description": "Run overnight (10 PM - 6 AM)",
      "cron_expression": "0 22-6 * * *"
    }
  }
}
```

---

## Deployment Process

### SSH-Based Automated Deployment

The deployment service executes the following steps via SSH:

1. **Connect to Host** (10%) - Establish SSH connection
2. **Create Directory** (20%) - Create deployment directory
3. **Clone Repository** (30%) - Git clone from GitHub
4. **Install Dependencies** (50%) - Install Python packages
5. **Configure Settings** (70%) - Generate `settings.ini`
6. **Start Swarm** (90%) - Launch heartbeat agent and API server
7. **Register Swarm** (100%) - Register with central backend

### Error Handling

- SSH connection failures return detailed error messages
- Failed deployments set status to `failed` with error logs
- Host capacity validated before deployment begins
- Automatic rollback on critical failures (future enhancement)

---

---

## Host Management API

### Base URL

```
http://localhost:3000/api/v1
```

### 28. List All Hosts

Get all registered hosts.

**Endpoint:** `GET /hosts`

**Example Request:**
```bash
curl http://localhost:3000/api/v1/hosts \
  -H "X-API-Key: your-api-key"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "host_id": "host-123",
      "name": "Production Server 1",
      "hostname": "192.168.1.100",
      "ssh_port": 22,
      "ssh_username": "deploy",
      "max_swarms": 5,
      "active_swarms": 2,
      "status": "online",
      "created_at": "2025-10-01T10:00:00Z"
    }
  ]
}
```

---

### 29. List Available Hosts

Get hosts with available capacity for new deployments.

**Endpoint:** `GET /hosts/available`

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "host_id": "host-123",
      "name": "Production Server 1",
      "available_capacity": 3,
      "max_swarms": 5,
      "active_swarms": 2
    }
  ]
}
```

---

### 30. Register New Host

Register a new host for swarm deployments.

**Endpoint:** `POST /hosts`

**Request Body:**
```json
{
  "name": "Production Server 2",
  "hostname": "192.168.1.101",
  "ssh_port": 22,
  "ssh_username": "deploy",
  "ssh_private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
  "max_swarms": 10
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "host_id": "host-456",
    "name": "Production Server 2",
    "status": "online"
  }
}
```

---

### 31. Execute SSH Command

Execute a command on a registered host.

**Endpoint:** `POST /hosts/:host_id/execute`

**Request Body:**
```json
{
  "command": "df -h",
  "timeout": 30000
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "stdout": "Filesystem      Size  Used Avail Use% Mounted on\n...",
    "stderr": "",
    "exit_code": 0
  }
}
```

---

## Discord Webhook Notifications

QiFlow Control Center includes Discord webhook integration for automated notifications.

### Setup

See `docs/discord-integration.md` for complete setup instructions.

**Quick Start:**
1. Create Discord webhooks in your server
2. Add webhook URLs to GitHub secrets:
   - `DISCORD_COMMIT_CHANNEL`
   - `DISCORD_RELEASE_CHANNEL`
3. GitHub Actions workflows automatically send notifications

### Programmatic Usage

```typescript
import { discordWebhookService } from './services/discordWebhookService';

// Send commit notification
await discordWebhookService.sendCommitNotification(webhookUrl, {
  sha: 'abc123',
  message: 'Fix authentication bug',
  author: 'Developer Name',
  url: 'https://github.com/repo/commit/abc123',
  branch: 'main',
  repository: 'QiFlowGo'
});

// Send release notification
await discordWebhookService.sendReleaseNotification(webhookUrl, {
  name: 'v1.0.0',
  tag: 'v1.0.0',
  body: 'Release notes',
  author: 'Release Manager',
  url: 'https://github.com/repo/releases/v1.0.0',
  repository: 'QiFlowGo',
  prerelease: false
});

// Send custom notification
await discordWebhookService.sendCustomNotification(
  webhookUrl,
  'Custom Title',
  'Custom message content',
  0x00FF00, // Green color
  [
    { name: 'Field', value: 'Value', inline: true }
  ]
);
```

### Notification Types

**Commit Notifications** 📝
- Triggered on push to main/develop branches
- Includes: commit message, author, SHA, branch, repository
- Color: Discord Blurple (0x5865F2)

**Release Notifications** 🎉
- Triggered when releases are published
- Includes: release name, tag, notes, author
- Colors: Green for releases, Yellow for pre-releases

**Feature Request Notifications** 💡
- Programmatic support for issue notifications
- Includes: title, description, author, labels
- Color: Pink (0xEB459E)

**Custom Notifications**
- Fully customizable embeds
- User-defined colors and fields
- Generic QiFlow Bot username

### GitHub Actions Integration

The following workflows automatically send Discord notifications:

**`.github/workflows/discord-commit-notification.yml`**
- Runs on push to main/develop
- Posts commit details to Discord

**`.github/workflows/discord-release-notification.yml`**
- Runs on release published
- Posts release announcement to Discord

---

## Future Enhancements

**Deployment System:**
- GitHub OAuth integration for repository selection
- Automatic rollback on deployment failure
- Health check validation post-deployment
- Docker-based deployment option
- Multi-stage deployment (dev/staging/prod)

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
