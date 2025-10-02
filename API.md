# QiFlow Control Center - Backend API Documentation

## Human Intervention Flagging System

This API provides endpoints for managing intervention flags that alert when issues require human attention.

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication

Authentication will be implemented in a future update. Currently, all endpoints are open for development.

---

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

## Future Enhancements

- Push notifications when flags are created
- Email notifications for critical flags
- Slack/Discord integration
- Custom flagging rules engine
- Machine learning-based priority prediction
- Integration with GitHub webhooks
