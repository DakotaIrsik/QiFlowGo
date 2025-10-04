# QiFlow Control Center - User Guide

## Introduction

Welcome to QiFlow Control Center! This guide will help you get started with monitoring and managing your QiFlow swarm deployments from your mobile device.

## What is QiFlow Control Center?

QiFlow Control Center is a mobile command center that lets you:
- Monitor multiple QiFlow swarms in real-time
- Track project completion and progress
- Receive alerts for critical events
- Control swarms remotely (pause, resume, restart)
- View analytics and insights
- Access swarm hosts via SSH

## Getting Started

### Prerequisites

- iOS 13.0+ or Android 8.0+
- Active internet connection
- Administrator-provided login credentials

### Installation

**iOS:**
1. Download the IPA file from the latest release
2. Install via TestFlight or enterprise distribution
3. Trust the certificate if prompted

**Android:**
1. Download the APK file from the latest release
2. Enable "Install from Unknown Sources" if prompted
3. Install the APK

### First-Time Setup

1. **Launch the app** - Open QiFlow Control Center
2. **Sign in** - Enter your email and password
3. **Enable 2FA** (Optional but recommended)
   - Scan QR code with authenticator app
   - Enter the 6-digit code
4. **Grant permissions** - Allow notifications for alerts
5. **Complete onboarding** - Follow the wizard to configure preferences

## Dashboard Overview

The dashboard is your command center, showing all registered swarms at a glance.

### Swarm Cards

Each swarm displays:
- **Project name** and repository
- **Completion percentage** (e.g., 73% Complete)
- **Issues breakdown**: Done, Active, Ready, Blocked
- **Human intervention alerts** (if any)
- **Velocity** (issues closed per day)
- **Estimated completion date**

### Status Indicators

- 🟢 **Green**: Swarm is healthy and running
- 🟡 **Yellow**: Warning - check details
- 🔴 **Red**: Critical issue - immediate attention needed
- ⚫ **Gray**: Swarm offline

### Quick Actions

Swipe left on any swarm card for quick actions:
- **View Details** - Open detailed swarm view
- **Pause/Resume** - Toggle swarm execution
- **SSH Connect** - Quick SSH access
- **Refresh** - Force status update

## Swarm Detail View

Tap any swarm card to open the detail view with comprehensive information.

### Tabs

#### 1. Activity Feed
Real-time stream of swarm activity:
- Recent commits
- Pull requests created/merged
- Issues opened/closed
- Test results
- Agent status changes

**Features:**
- Auto-refresh every 15 seconds
- Pull-to-refresh for manual update
- Filter by event type
- Jump to GitHub for details

#### 2. Agent Status
Current status of all agents in the swarm:
- Agent name and role
- Current task
- Status (idle, working, blocked)
- Resource usage
- Last activity timestamp

**Control Buttons:**
- **Restart Agent** - Restart individual agent
- **View Logs** - Check agent execution logs
- **Emergency Stop** - Immediately halt agent

#### 3. Resource Metrics
System resource usage with charts:
- **CPU Usage** - Current and historical (last 24h)
- **Memory Usage** - Available vs used
- **Disk Space** - Total, used, available
- **API Quota** - GitHub API calls remaining

**Alerts:**
- Red warning if disk >90% full
- Yellow warning if CPU >80% sustained
- Alert if API quota <100 calls

#### 4. Schedule
Configure when your swarm runs:

**Presets:**
- Business Hours (9am-5pm weekdays)
- 24/7 Continuous
- Night Only (10pm-6am)
- Custom

**Cron Editor:**
- Visual cron builder
- Preview next 5 run times
- Save and deploy instantly

#### 5. Issue Board
Kanban-style board showing all issues:

**Columns:**
- Ready (backlog)
- In Progress (agents working)
- Blocked (needs attention)
- Done (completed)

**Issue Cards Show:**
- Issue number and title
- Current assignee (agent or human)
- Time in current status
- Priority badge
- Human intervention flag (if applicable)

**Actions:**
- Tap issue → Open in GitHub
- Swipe right → Flag for attention
- Swipe left → Add comment
- Long press → Assign to yourself

## Project Completion Tracking

### Collapsed View (Dashboard)

Each swarm card shows:
```
🎯 73% Complete
✅ Done: 45  🔄 Active: 8
📋 Ready: 12 🚧 Blocked: 3
🔴 2 need attention
```

### Expanded View (Detail)

Tap the completion card to see full details:

**Progress Breakdown:**
- Large percentage display
- Animated progress bar
- Issues by status with percentages

**Human Intervention Section:**
Lists issues requiring your attention:
- Priority badge (🔴 Critical, 🟡 Review)
- Issue title and number
- Agent status message
- Time blocked
- Quick action buttons

**Example:**
```
🔴 CRITICAL
#127 Merge conflict in auth module
Agent: Unable to resolve conflict
Blocked for: 2 days
[View Issue] [Assign to Me]
```

**Velocity Trends:**
- 7-day bar chart (issues closed per day)
- Average velocity
- Trend indicator (↑↓→)

**Forecast:**
- Estimated completion date
- Confidence level (High/Medium/Low)
- Based on current velocity

## Alerts & Notifications

### Alert Types

**Critical (Immediate):**
- Swarm offline
- API quota exhausted
- Disk space critical
- Human intervention required

**Warning (Delayed):**
- Test coverage drop
- Rate limits approaching
- High resource usage

**Info (In-app only):**
- Milestone completed
- PR merged
- Issue closed

### Notification Settings

Configure per-swarm preferences:

1. Tap swarm → Settings → Notifications
2. Toggle alert types on/off
3. Set Do Not Disturb schedule
4. Choose notification sound
5. Enable/disable vibration

### Snoozing Alerts

Temporarily mute alerts for a swarm:
- Tap alert notification
- Select "Snooze"
- Choose duration (1h, 4h, 24h, 1 week)
- Alert will return after snooze period

## Managing Human Interventions

When an issue requires human attention:

### Identifying Flagged Issues

**Dashboard Indicator:**
```
🔴 2 need attention
```

**Detail View:**
Full list with:
- Priority level
- Issue details
- Agent message
- Time blocked
- Quick actions

### Taking Action

**Option 1: View Issue**
- Opens GitHub issue in browser
- Review agent comments
- Understand the problem

**Option 2: Assign to Me**
- Creates GitHub assignment
- Marks you as responsible
- Removes from intervention list

**Option 3: Approve/Reject**
(For review-type issues)
- Agent continues if approved
- Agent adjusts approach if rejected

### Resolving Interventions

Once resolved on GitHub:
- Intervention automatically clears
- Issue moves to appropriate status
- Velocity tracking resumes

## Remote Control Actions

### Pause/Resume Swarm

**When to Use:**
- Temporarily halt work (e.g., during deployment)
- Conserve API quota
- Debugging issues

**How:**
1. Tap swarm → Control → Pause
2. Confirm action
3. Status updates to "Paused"
4. Resume when ready

### Restart Agent

**When to Use:**
- Agent appears stuck
- After configuration change
- Memory leak suspected

**How:**
1. Tap swarm → Agent Status
2. Select agent → Restart
3. Confirm action
4. Monitor restart progress

### Force Sync

**When to Use:**
- Repository changes not reflected
- After manual GitHub actions
- Sync appears stale

**How:**
1. Tap swarm → Control → Force Sync
2. Wait for sync to complete
3. Verify updates appear

### Emergency Stop

**When to Use:**
- Agent misbehaving
- Unintended changes detected
- Security concern

**How:**
1. Tap swarm → Control → Emergency Stop
2. Confirm (requires second confirmation)
3. All agents halt immediately
4. Manual restart required

## SSH Quick Connect

Access your swarm host directly via SSH:

### Prerequisites

**iOS:**
- Termius, Prompt, or Blink Shell installed

**Android:**
- Termux, JuiceSSH, or ConnectBot installed

### Connecting

1. Tap swarm → SSH Connect
2. Select SSH client (if multiple installed)
3. App launches with pre-filled connection
4. Enter password or use saved credentials

### Fallback (Copy Command)

If no SSH client installed:
1. Tap "Copy SSH Command"
2. Paste into terminal app
3. Execute manually

### Security

- Credentials stored encrypted
- Optional biometric authentication
- Connection logs for audit

## Customer & Project Management

(Available to admin users)

### Customer List

View all customers:
- Customer name and contact
- Active projects count
- Total monthly spend
- Revenue share

### Customer Detail

Tap customer to see:
- All associated projects
- Billing history
- API cost breakdown
- Revenue calculations

### Project Detail

View project metrics:
- Completion percentage
- Issues breakdown
- Velocity trends
- Cost to date
- Estimated total cost

### Billing Dashboard

Export billing data:
1. Navigate to Customer → Billing
2. Select date range
3. Tap "Export CSV"
4. Email or share invoice data

## Analytics & Insights

### Performance Metrics

Track swarm productivity:
- Issues closed per day (velocity)
- Average time to close issue
- PR merge rate
- Test pass rate

**Charts:**
- Line chart: Velocity over time
- Bar chart: Issues by status
- Pie chart: Time distribution

### Cost Analysis

Monitor API and resource costs:
- GitHub API calls used
- Estimated API cost
- Compute resource usage
- Total cost per project

**Breakdown:**
- Daily cost trend
- Cost by service (GitHub, hosting, etc.)
- Projected monthly total

### Swarm Comparison

Compare multiple swarms:
- Side-by-side metrics
- Relative performance
- Cost efficiency
- Velocity ranking

## Troubleshooting

### Swarm Shows Offline

**Possible Causes:**
- Network issue on swarm host
- Heartbeat agent stopped
- Backend connectivity issue

**Solutions:**
1. Check swarm host is online
2. SSH into host and check agent: `ps aux | grep heartbeat`
3. Restart agent: `python -m core.heartbeat &`
4. Check backend status

### Notifications Not Received

**Checklist:**
- Notifications enabled in app settings
- Notifications enabled in device settings
- Alert type not muted
- Not in Do Not Disturb schedule
- Internet connection active

### Data Not Updating

**Solutions:**
1. Pull-to-refresh on dashboard
2. Tap swarm → Refresh
3. Check internet connection
4. Force close and reopen app
5. Contact administrator if persistent

### Can't Connect via SSH

**Checklist:**
- SSH client installed
- Credentials configured correctly
- Swarm host allows SSH connections
- Firewall not blocking port 22
- VPN connected if required

## Tips & Best Practices

### Dashboard Organization

- Star frequently monitored swarms for quick access
- Use custom tags to group related swarms
- Archive inactive swarms to reduce clutter

### Velocity Monitoring

- Check velocity trends weekly
- Investigate sudden drops
- Celebrate velocity improvements
- Share insights with team

### Human Intervention Response

- Check interventions daily
- Address critical issues within 24h
- Provide clear resolution notes
- Update agent if recurring patterns

### Resource Management

- Monitor API quota usage
- Pause low-priority swarms if quota low
- Increase disk space before critical
- Adjust schedules to optimize resources

### Security

- Enable 2FA for your account
- Use biometric authentication if available
- Never share login credentials
- Report suspicious activity immediately

## Getting Help

### In-App Support

- Tap Settings → Help
- Search knowledge base
- Submit support ticket
- View video tutorials

### Documentation

- User Guide (this document)
- Admin Guide (for administrators)
- API Reference (for developers)

### Community

- GitHub Issues for bug reports
- Discord community for discussions
- Feature requests via GitHub

## Glossary

**Agent** - Autonomous AI worker in a QiFlow swarm

**Heartbeat** - Status update sent by swarm to backend

**Human Intervention** - Issue flagged for human review/action

**Swarm** - Autonomous team of AI agents working on a project

**Velocity** - Rate of issue completion (issues per day)

**API Quota** - GitHub API call limit per hour/day

**SSH** - Secure Shell protocol for remote access

**2FA** - Two-Factor Authentication for enhanced security

---

**Version**: 1.0
**Last Updated**: 2025-10-04
