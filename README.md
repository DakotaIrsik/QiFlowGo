# QiFlow Control Center

A mobile command center for managing multiple QiFlow AI swarm deployments across VMs, Raspberry Pis, and cloud instances.

## Overview

QiFlow Control Center is a centralized monitoring and management platform that provides real-time visibility and control over distributed QiFlow swarm deployments. It combines a React Native mobile app with a Node.js backend to deliver a comprehensive fleet management solution for autonomous AI development teams.

## Key Features

### 📱 Mobile Command Center
- **Fleet Dashboard**: Real-time overview of all registered swarms with status, health metrics, and quick actions
- **Project Completion Tracking**: Clear percentage-based completion indicators with expandable details showing:
  - Overall project progress (e.g., "73% Complete")
  - Issues breakdown (Open, In Progress, Blocked, Done)
  - Issues flagged for human intervention with priority badges
  - Velocity trends and estimated completion date
  - Agent activity and productivity metrics
- **Swarm Detail View**: Deep dive into individual swarms with live activity feeds, agent status, resource metrics, and issue boards
- **Push Notifications**: Configurable alerts for critical events (swarm offline, API quota exhausted, disk critical, human intervention required)
- **Remote Control**: Pause/resume swarms, restart agents, force sync, emergency stop, and manual triggers
- **SSH Quick Connect**: Direct SSH access to swarm hosts from your mobile device

### 🔧 Operations & Management
- **Host Management**: Register and manage remote hosts via SSH connection pool
- **Swarm Deployment Wizard**: Automated deployment of new QiFlow swarms to registered hosts
- **Multi-Swarm Batch Operations**: Execute actions across multiple swarms simultaneously with grouping support
- **Schedule Configuration**: Visual cron editor with presets for managing swarm execution schedules

### 📊 Analytics & Insights
- **Performance Metrics**: Track swarm productivity, velocity, and efficiency trends
- **Cost Analysis**: Monitor API costs, resource usage, and revenue share calculations
- **Customer & Project Management**: Track billing, project progress, and estimated completion dates
- **GitHub Integration**: Aggregate metrics from all swarm repositories (commits, PRs, issues, test results)

### 🔒 Security & Reliability
- **Firebase Authentication**: Email/password login with optional 2FA
- **Encrypted Credential Storage**: Secure storage of SSH credentials and API tokens
- **Audit Logging**: Complete audit trail of all control actions
- **Command Whitelist**: Enforce security policies for remote operations

## Architecture

### Tech Stack

**Mobile App (React Native)**
- iOS and Android support
- TypeScript + ESLint
- Firebase Realtime Database for real-time updates
- Firebase Cloud Messaging for push notifications

**Backend (Node.js + Express)**
- RESTful API with JWT authentication
- Firebase Realtime Database and Authentication
- GitHub API integration with webhook support
- SSH connection pool for remote host management

**AI Integration**
- Heartbeat agent module integrated into QiFlow swarms
- Real-time telemetry via continuous API polling
- Mobile app polls swarm host APIs every 15-30 seconds
- Backend aggregates and caches swarm status
- Automatic alert detection and escalation

### System Components

1. **Swarm Heartbeat Agent** (`core/heartbeat.py`)
   - Runs on each QiFlow swarm deployment
   - Exposes REST API endpoints on swarm host for status polling
   - Sends status updates to central backend every 60 seconds
   - Collects system metrics, agent status, GitHub activity, and resource usage
   - Tracks project completion percentage based on issue states
   - Flags issues requiring human intervention based on:
     - Blocked status lasting >24 hours
     - Agent error patterns (3+ consecutive failures)
     - Security vulnerabilities detected
     - Test failures exceeding threshold (>10% failure rate)

2. **Monitoring API Service**
   - Central backend receiving heartbeat data and serving mobile app
   - Mobile app polls backend every 15-30 seconds for status updates
   - Backend polls swarm host APIs every 30 seconds as backup
   - Stores metrics in Firebase Realtime Database
   - Detects missed heartbeats and triggers alerts
   - Rate limiting (100 req/min per swarm)
   - Caches responses with 15-second TTL to reduce load

3. **GitHub Integration Service**
   - GitHub App with webhook handlers
   - Caches data to avoid rate limits (5-minute TTL)
   - Aggregates commits, PRs, issues, and test results
   - Real-time activity updates via webhooks
   - Calculates project completion metrics:
     - Total issues vs completed issues
     - Velocity (issues closed per day)
     - Estimated completion date using linear regression

4. **Host Management & Remote Control**
   - SSH connection pool for remote operations
   - Whitelisted commands (restart, update, logs)
   - Host registration and capacity validation
   - Audit logging for all actions

5. **Project Completion Tracker**
   - Aggregates issue data from GitHub and local swarm state
   - Calculates completion percentage: `(completed_issues / total_issues) * 100`
   - Identifies bottlenecks: issues in progress >48 hours
   - Flags human intervention requirements
   - Generates velocity trends and forecasts
   - Updates mobile UI with expandable progress cards showing:
     - Large percentage indicator (e.g., "73%")
     - Breakdown by status (Ready: 12, In Progress: 8, Blocked: 3, Done: 45)
     - Priority badges for flagged issues (🔴 Critical, 🟡 Review Needed)
     - Tap to expand for detailed issue list with agent activity

## API Endpoints

### Monitoring & Status Polling
The mobile app continuously polls swarm host APIs to maintain real-time status updates:

- `POST /api/v1/heartbeat` - Receive heartbeat from swarms
- `GET /api/v1/swarms` - List all registered swarms (polled every 30s from dashboard)
- `GET /api/v1/swarms/:swarm_id` - Get detailed swarm status (polled every 15s from detail view)
- `GET /api/v1/swarms/:swarm_id/status` - Lightweight status check (CPU, memory, active agents)
- `GET /api/v1/swarms/:swarm_id/progress` - Project completion percentage and breakdown
- `POST /api/v1/swarms/:swarm_id/control` - Execute control actions

### Project Tracking
- `GET /api/v1/swarms/:swarm_id/project/completion` - Returns:
  - `completion_percentage` (0-100)
  - `total_issues`, `completed_issues`, `in_progress_issues`, `blocked_issues`
  - `issues_requiring_human_intervention` (array with priority flags)
  - `estimated_completion_date` (based on velocity)
  - `velocity_trend` (issues/day over last 7 days)
- `GET /api/v1/swarms/:swarm_id/project/issues` - Paginated issue list with filters
- `PUT /api/v1/swarms/:swarm_id/issues/:issue_id/flag` - Flag/unflag issue for human intervention
- `GET /api/v1/swarms/:swarm_id/project/timeline` - Historical progress data for charts

### GitHub Integration
- `GET /api/v1/swarms/:swarm_id/github/activity` - Get GitHub activity feed
- `GET /api/v1/swarms/:swarm_id/github/metrics` - Get aggregated GitHub metrics
- `POST /api/v1/github/webhook` - Handle GitHub webhook events

## Alert Types

**Critical Alerts** (immediate notification)
- Swarm offline (>90 seconds without heartbeat)
- API quota exhausted
- Disk space critical

**Warning Alerts** (notification with delay)
- Test coverage drop
- Rate limits approaching
- High resource usage (CPU/memory)

**Info Alerts** (in-app only)
- Milestone completed
- Pull request merged
- Issue closed

**Human Intervention Alerts** (high priority notification)
- Issue blocked and flagged for human review
- Agent unable to proceed with task
- Merge conflict requiring manual resolution
- Security vulnerability detected requiring approval
- Test failures exceeding threshold

## Deployment Flow

1. **Select Host**: Choose from registered hosts
2. **Select Repository**: GitHub OAuth flow to select repository
3. **Choose Schedule**: Apply preset or custom cron schedule
4. **Configure Agents**: Define agent roles and responsibilities
5. **Customer/Billing**: Link to customer and billing information
6. **Deploy**: Automated installation and post-deployment validation

## Mobile UI Specification

### Project Completion Card (Dashboard & Detail View)

Each swarm displays a **prominent completion percentage card** that serves as the primary status indicator:

**Collapsed State (Dashboard)**
```
┌─────────────────────────────────────┐
│  ProjectName Repository              │
│  ┌───────────────────────────────┐  │
│  │        🎯 73%                  │  │
│  │      Complete                  │  │
│  ├───────────────────────────────┤  │
│  │ ✅ Done: 45  🔄 Active: 8     │  │
│  │ 📋 Ready: 12 🚧 Blocked: 3    │  │
│  │ 🔴 2 need attention            │  │
│  └───────────────────────────────┘  │
│  Velocity: 6.2 issues/day          │
│  Est. Completion: Nov 15, 2025     │
└─────────────────────────────────────┘
      ↓ Tap to expand ↓
```

**Expanded State (Detail View)**
```
┌─────────────────────────────────────────────┐
│  🎯 Project Completion: 73%                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Progress Bar (filled to 73%)               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                             │
│  📊 Issues Breakdown                        │
│  ┌─────────────────────────────────────┐   │
│  │ ✅ Done: 45      (66%)              │   │
│  │ 🔄 In Progress: 8 (12%)             │   │
│  │ 📋 Ready: 12     (18%)              │   │
│  │ 🚧 Blocked: 3    (4%)               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🚨 Requires Human Intervention (2)         │
│  ┌─────────────────────────────────────┐   │
│  │ 🔴 CRITICAL                          │   │
│  │ #127 Merge conflict in auth module  │   │
│  │ Agent: Unable to resolve conflict   │   │
│  │ Blocked for: 2 days                 │   │
│  │ [View Issue] [Assign to Me]         │   │
│  ├─────────────────────────────────────┤   │
│  │ 🟡 REVIEW NEEDED                    │   │
│  │ #134 Security vulnerability found   │   │
│  │ Agent: Waiting for approval         │   │
│  │ Flagged: 6 hours ago                │   │
│  │ [View Issue] [Approve] [Reject]     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  📈 Velocity Trends (Last 7 Days)           │
│  ┌─────────────────────────────────────┐   │
│  │  Issues Closed per Day               │   │
│  │    █                                 │   │
│  │  █ █     █                           │   │
│  │  █ █ █ █ █ █ █                       │   │
│  │  M T W T F S S  Avg: 6.2/day         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🎯 Forecast                                │
│  Estimated Completion: Nov 15, 2025         │
│  Based on current velocity (6.2 issues/day) │
│  Confidence: High (95%)                     │
│                                             │
│  📋 All Issues (Filterable)                 │
│  ┌─────────────────────────────────────┐   │
│  │ [Done] [Active] [Ready] [Blocked]   │   │
│  ├─────────────────────────────────────┤   │
│  │ ✅ #125 Implement user auth          │   │
│  │    Closed 2 hours ago by Agent-1    │   │
│  ├─────────────────────────────────────┤   │
│  │ 🔄 #126 Add OAuth integration        │   │
│  │    In Progress (Agent-2, 3h)        │   │
│  ├─────────────────────────────────────┤   │
│  │ 🚧 #127 Merge conflict (FLAGGED)    │   │
│  │    Blocked for 2 days               │   │
│  └─────────────────────────────────────┘   │
│             [Load More]                    │
└─────────────────────────────────────────────┘
```

**Real-time Updates**
- Percentage updates immediately when issue status changes
- Polling occurs every 15 seconds when detail view is active
- Polling occurs every 30 seconds when dashboard is visible
- Background polling paused when app is backgrounded
- Pull-to-refresh for manual updates

**Interactive Elements**
- Tap percentage card → Expand to full detail view
- Tap flagged issue → Open issue detail with intervention options
- Tap "Assign to Me" → Create GitHub issue assignment
- Swipe issue card → Quick actions (Flag, Unflag, Comment)

## Development Milestones

### QiFlow Control Center v1.0
**Critical Features**
- ✅ Project setup and infrastructure
- 🔄 Swarm heartbeat agent module with API endpoints
- 🔄 Monitoring API service with continuous polling
- 🔄 Mobile authentication & onboarding
- 🔄 Dashboard (fleet overview) with completion cards
- 🔄 Swarm detail view with expandable progress tracking
- 🔄 Swarm control actions
- 🔄 Push notifications & alerts (including human intervention)
- 🔄 Host management & remote control
- 🔄 Project completion percentage tracking and UI
- 🔄 Human intervention flagging system

**High Priority Features**
- 🔄 GitHub integration service with completion metrics
- 🔄 End-to-end test suite
- 🔄 Security audit & penetration testing
- 🔄 CI/CD pipeline with automated IPA/APK releases

**Medium Priority Features**
- 🔄 Swarm deployment wizard
- 🔄 Customer & project management
- 🔄 Analytics & insights with velocity forecasting
- 🔄 SSH quick connect
- 🔄 Documentation & setup guide

### QiFlow Control Center v2.0
- Multi-swarm batch operations
- Advanced analytics and forecasting with ML predictions
- Custom dashboard builder
- Custom alert rules engine
- Multi-tenancy support for agencies

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- React Native development environment (iOS: Xcode, Android: Android Studio)
- Firebase project with Auth, Realtime Database, and Cloud Messaging enabled
- GitHub App credentials for API integration
- SSH access to target deployment hosts

### Installation

**Backend Setup**
```bash
# Clone the repository
git clone <repository-url>
cd qiflow-control-center-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Firebase and GitHub credentials

# Start the server
npm run dev
```

**Mobile App Setup**
```bash
# Clone the repository
git clone <repository-url>
cd qiflow-control-center-mobile

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Configuration

**Firebase Setup**
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password and optional 2FA)
3. Enable Realtime Database with appropriate security rules
4. Enable Cloud Messaging for push notifications
5. Download configuration files:
   - `google-services.json` for Android
   - `GoogleService-Info.plist` for iOS

**GitHub App Setup**
1. Create a GitHub App with permissions: repositories (read), metadata (read), webhooks
2. Configure webhook URL: `https://your-backend.com/api/v1/github/webhook`
3. Subscribe to events: commit, pull_request, issues, check_suite
4. Note your App ID and generate a private key

**Swarm Integration**
Add to each QiFlow swarm's `settings.ini`:
```ini
[heartbeat]
monitor_url=https://your-backend.com/api/v1/heartbeat
api_key=your-swarm-api-key
interval=60
enable_api=true
api_port=8080

[project_tracking]
enabled=true
github_repo=owner/repo
flag_blocked_after_hours=24
flag_failures_threshold=3
flag_test_failure_rate=0.10
```

The swarm will expose the following local API endpoints for polling:
- `GET http://swarm-host:8080/status` - Current status and metrics
- `GET http://swarm-host:8080/project/completion` - Project completion data
- `GET http://swarm-host:8080/project/issues` - Issue list with intervention flags

## Security Considerations

- **Never expose SSH credentials** in configuration files or logs
- **Firebase security rules** must validate authentication and authorization
- **Rate limiting** prevents API abuse (100 req/min per swarm)
- **Command whitelist** restricts remote operations to safe commands
- **Audit logging** captures all control actions for compliance
- **JWT tokens** expire after configurable period (default: 24 hours)
- **Biometric authentication** optional for mobile app access

## CI/CD Pipeline

QiFlow Control Center uses GitHub Actions for continuous integration and deployment, automatically building and releasing mobile artifacts on every push to main or release branches.

### Automated Build & Release Pipeline

**Mobile App (iOS & Android)**

The CI/CD pipeline automatically:
1. Runs all tests (unit + E2E) on every PR
2. Builds release artifacts (IPA + APK) on merge to main
3. Uploads signed builds to GitHub Releases
4. Optionally deploys to TestFlight (iOS) and Google Play Internal Testing (Android)

**Workflow Structure**

```yaml
# .github/workflows/mobile-ci.yml
- PR Checks: Lint, test, build verification
- Main Branch: Full release build with signed artifacts
- Release Tags: Production deployment to app stores
```

### GitHub Actions Workflows

**1. Pull Request Validation** (`.github/workflows/pr-check.yml`)
- Runs on every PR to main
- ESLint and TypeScript type checking
- Jest unit tests (>75% coverage required)
- iOS and Android build smoke tests
- Prevents merge if any check fails

**2. Mobile Build & Release** (`.github/workflows/mobile-release.yml`)
- Triggers on push to main or release tags
- Parallel iOS and Android builds
- Signs builds with certificates from GitHub Secrets
- Generates release notes from commits
- Uploads artifacts to GitHub Releases:
  - `QiFlowControlCenter-v{version}-ios.ipa`
  - `QiFlowControlCenter-v{version}-android.apk`
  - `QiFlowControlCenter-v{version}-android-bundle.aab` (for Play Store)

**3. Backend Deployment** (`.github/workflows/backend-deploy.yml`)
- Deploys Node.js backend to cloud platform (Firebase Functions, AWS Lambda, or DigitalOcean)
- Runs database migrations
- Updates API documentation
- Health check verification post-deployment

### Release Artifacts

Every successful build generates the following artifacts:

**iOS (.ipa)**
- Ad-hoc distribution build for TestFlight
- Enterprise distribution for direct installation
- Includes provisioning profile and code signing

**Android (.apk + .aab)**
- APK for direct installation and testing
- AAB (Android App Bundle) for Google Play Store
- Signed with release keystore

### Secrets Configuration

Required GitHub Secrets for CI/CD:

**iOS Code Signing**
- `IOS_CERTIFICATE_BASE64` - Apple distribution certificate
- `IOS_PROVISIONING_PROFILE_BASE64` - Provisioning profile
- `IOS_CERTIFICATE_PASSWORD` - Certificate password
- `APP_STORE_CONNECT_API_KEY` - For TestFlight uploads

**Android Code Signing**
- `ANDROID_KEYSTORE_BASE64` - Release keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password

**Backend & Services**
- `FIREBASE_SERVICE_ACCOUNT` - Firebase admin credentials
- `GITHUB_APP_PRIVATE_KEY` - GitHub App authentication
- `SSH_DEPLOY_KEY` - For deployment to cloud servers

### Version Management

Versioning follows semantic versioning (SemVer):
- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features)
- `v1.1.1` - Patch release (bug fixes)

Automated version bumping:
```bash
npm run version:patch  # 1.0.0 -> 1.0.1
npm run version:minor  # 1.0.0 -> 1.1.0
npm run version:major  # 1.0.0 -> 2.0.0
```

### Release Process

**Automated Release (Recommended)**
1. Merge PR to main branch
2. GitHub Actions automatically:
   - Runs all tests
   - Builds iOS IPA and Android APK/AAB
   - Signs artifacts with production certificates
   - Creates GitHub Release with artifacts
   - Optionally uploads to TestFlight/Play Store

**Manual Release (Emergency Only)**
```bash
# iOS
cd ios && fastlane release

# Android
cd android && ./gradlew bundleRelease
```

### Download Latest Release

Production builds are available at:
```
https://github.com/your-org/qiflow-control-center/releases/latest
```

Direct links:
- **iOS (IPA)**: `https://github.com/your-org/qiflow-control-center/releases/latest/download/QiFlowControlCenter-ios.ipa`
- **Android (APK)**: `https://github.com/your-org/qiflow-control-center/releases/latest/download/QiFlowControlCenter-android.apk`

### Testing

**Backend Tests**
```bash
npm test                  # Run all tests
npm run test:coverage     # Generate coverage report
npm run test:e2e         # End-to-end API tests
```

**Mobile Tests**
```bash
npm test                  # Jest unit tests
npm run test:e2e:ios     # Detox E2E tests (iOS)
npm run test:e2e:android # Detox E2E tests (Android)
```

**Coverage Goals**
- Backend API: >85% coverage
- Mobile App: >75% coverage
- All critical user flows covered by E2E tests

### Continuous Deployment Strategy

**Development Flow**
- Feature branches → PR with automated checks → Merge to main → Auto-deploy to staging
- Release tags (v*.*.* ) → Auto-deploy to production

**Rollback Strategy**
- GitHub Release artifacts retained for 90 days
- One-click rollback via GitHub Actions manual trigger
- Database migrations versioned and reversible

## Contributing

This project is under active development. For feature requests and bug reports, please create GitHub issues with appropriate labels:
- `feature`: New functionality
- `bug`: Bug reports
- `docs`: Documentation improvements
- `security`: Security-related issues
- `testing`: Test coverage improvements

## License

[Add your license information here]

## Support

For questions, issues, or feature requests:
- Create a GitHub issue with detailed description
- Check existing documentation in `/docs` folder
- Review API reference at `/docs/api-reference.md`

---

**Status**: 🚧 Under Active Development
**Version**: Pre-release (v1.0 in progress)
**Last Updated**: 2025-10-02
