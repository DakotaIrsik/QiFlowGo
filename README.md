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
- Backend polls swarm host APIs every 30 seconds
- Mobile app polls central backend every 15-30 seconds
- Response caching with 15-30s TTL to reduce load
- Automatic alert detection and escalation

### System Components

1. **Swarm Heartbeat Agent Module** ✅ (Implemented)
   - Heartbeat agent module: `core/heartbeat.py`, `core/api_server.py`
   - Runs on each QiFlow swarm deployment
   - Exposes REST API endpoints on swarm host (port 8080) for direct polling
   - Sends status updates to central backend every 60 seconds
   - Collects system metrics (CPU, memory, disk), agent status, GitHub activity, and resource usage
   - Flask-based API with 6 endpoints (/health, /status, /project/completion, /project/issues, /metrics, /agent/status)
   - Comprehensive test suite with 39 unit tests (100% passing)
   - Automatic retry logic for network failures (3 retries, 5s delay)
   - Local metric logging for debugging and offline operation
   - Full documentation in `docs/heartbeat-agent.md`

2. **Human Intervention Flagging System** ✅ (Implemented)
   - Backend API service for managing intervention flags (`src/routes/interventionRoutes.ts`)
   - Database schema and models for tracking issues requiring human attention
   - Automated flagging logic based on configurable criteria
   - REST API endpoints for flag management (see `API.md` for details)
   - Background services for continuous monitoring
   - Comprehensive test coverage (90%+)

3. **Monitoring API Service** ✅ (Implemented)
   - Central backend receiving heartbeat data and serving mobile app (`src/routes/swarmRoutes.ts`)
   - Mobile app polls backend every 15-30 seconds for status updates
   - Backend polls swarm host APIs every 30 seconds (`src/services/swarmPollingService.ts`)
   - SwarmModel manages swarm registry with PostgreSQL (`src/models/SwarmModel.ts`)
   - Automatic offline detection for stale swarms (>60s without update)
   - Response caching with configurable TTL (15s for details, 30s for lists)
   - Cache invalidation on data changes and manual refresh endpoint
   - Parallel polling with 5-second timeout per swarm
   - Comprehensive test coverage for routes and caching

4. **GitHub Integration Service** (Planned)
   - GitHub App with webhook handlers
   - Caches data to avoid rate limits (5-minute TTL)
   - Aggregates commits, PRs, issues, and test results
   - Real-time activity updates via webhooks
   - Calculates project completion metrics:
     - Total issues vs completed issues
     - Velocity (issues closed per day)
     - Estimated completion date using linear regression

5. **Host Management & Remote Control** (Planned)
   - SSH connection pool for remote operations
   - Whitelisted commands (restart, update, logs)
   - Host registration and capacity validation
   - Audit logging for all actions

6. **Velocity Metrics & Project Completion Tracker** ✅ (Implemented)
   - Basic metrics collection implemented in heartbeat agent
   - Exposes `/project/completion` endpoint with completion percentage
   - Calculates completion percentage: `(completed_issues / total_issues) * 100`
   - Returns issues breakdown by status and intervention flags
   - **Advanced velocity analytics service** (`src/services/velocityService.ts`):
     - Rolling velocity calculation (issues per day over configurable period)
     - Linear regression-based trend detection (increasing/stable/decreasing)
     - Confidence level calculation based on velocity variance (CV)
     - Completion date forecasting with trend-adjusted estimates
     - Standard deviation and coefficient of variation analysis
   - **Velocity database models** (`src/models/VelocityMetricsModel.ts`):
     - Daily velocity metrics tracking (issues_closed, issues_opened, net_progress)
     - Issue completions with time-to-complete tracking
     - Historical data aggregation for trend analysis
   - Automated daily metrics aggregation via cron job
   - Comprehensive test coverage for all velocity calculations

## API Endpoints

### Human Intervention Management ✅ (Implemented)
See `API.md` for comprehensive documentation. Key endpoints:

- `GET /api/v1/swarms/:swarm_id/interventions` - List intervention flags with filtering
- `GET /api/v1/swarms/:swarm_id/interventions/count` - Count unresolved flags by priority
- `POST /api/v1/swarms/:swarm_id/issues/:issue_id/flag` - Manually flag issue for intervention
- `PUT /api/v1/swarms/:swarm_id/interventions/:flag_id/resolve` - Mark intervention as resolved
- `DELETE /api/v1/swarms/:swarm_id/issues/:issue_id/flag/:flag_id` - Remove intervention flag
- `POST /api/v1/swarms/:swarm_id/interventions/bulk-resolve` - Bulk resolve multiple flags

### Swarm Host API ✅ (Implemented)
Direct polling endpoints exposed by each swarm (running on port 8080):

- `GET http://swarm-host:8080/health` - Health check with swarm_id and timestamp
- `GET http://swarm-host:8080/status` - Current swarm status (system, resources, agents)
- `GET http://swarm-host:8080/project/completion` - Project completion percentage and breakdown
- `GET http://swarm-host:8080/project/issues` - Paginated issue list with filters (page, limit, status, flagged)
- `GET http://swarm-host:8080/metrics` - All collected metrics (system, agents, GitHub, resources, project)
- `GET http://swarm-host:8080/agent/status` - Heartbeat agent status and configuration

See `docs/heartbeat-agent.md` for full API documentation with request/response examples.

### Central Backend API ✅ (Implemented)
Core swarm management endpoints for mobile app polling:

- `GET /api/v1/swarms` - List all registered swarms (30s cache, polled every 30s from dashboard)
- `GET /api/v1/swarms/:swarm_id` - Get detailed swarm status (15s cache, polled every 15s from detail view)
- `GET /api/v1/swarms/:swarm_id/status` - Lightweight status check (15s cache)
- `POST /api/v1/swarms` - Register new swarm with host URL and metadata
- `DELETE /api/v1/swarms/:swarm_id` - Unregister swarm
- `POST /api/v1/swarms/refresh` - Force cache invalidation for fresh data

**Planned Endpoints:**
- `POST /api/v1/heartbeat` - Receive heartbeat from swarms
- `POST /api/v1/swarms/:swarm_id/control` - Execute control actions
- `GET /api/v1/swarms/:swarm_id/project/timeline` - Historical progress data for charts

### GitHub Integration (Planned)
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
- ✅ Swarm heartbeat agent module with API endpoints (PR #26)
- ✅ Human intervention flagging system (PR #25)
- ✅ Central monitoring API service with continuous polling (PR #28 - Issue #20)
- ✅ Swarm registry and management endpoints
- ✅ Background polling service with automatic offline detection
- ✅ Response caching with configurable TTL
- ✅ Velocity metrics system with trend analysis and forecasting
- ✅ Comprehensive E2E test suite for backend API (PR #28 - Issue #16)
- 🔄 Mobile authentication & onboarding
- 🔄 Dashboard (fleet overview) with completion cards
- 🔄 Swarm detail view with expandable progress tracking
- 🔄 Swarm control actions
- 🔄 Push notifications & alerts (including human intervention)
- 🔄 Host management & remote control

**High Priority Features**
- 🔄 GitHub integration service with webhook support
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
- **Python 3.8+** (for heartbeat agent on swarm hosts)
- **Node.js 18+** and npm/yarn (for backend API and mobile app)
- React Native development environment (iOS: Xcode, Android: Android Studio)
- **PostgreSQL** (for intervention flagging database)
- Firebase project with Auth, Realtime Database, and Cloud Messaging enabled
- GitHub App credentials for API integration
- SSH access to target deployment hosts

### Installation

**Swarm Heartbeat Agent Setup** (on each swarm host)
```bash
# Clone the repository
git clone <repository-url>
cd QiFlowGo

# Install Python dependencies
pip install -r requirements.txt

# Configure the agent
cp settings.ini.example settings.ini
# Edit settings.ini with monitor_url, api_key, github_repo, etc.

# Run tests
pytest tests/

# Start the heartbeat agent and API server
python -m core.heartbeat &       # Sends metrics every 60s
python -m core.api_server &      # Serves API on port 8080

# Verify it's working
curl http://localhost:8080/health
```

**Backend API Setup** (Node.js)
```bash
# Clone the repository
git clone <repository-url>
cd QiFlowGo

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Firebase, GitHub, and PostgreSQL credentials

# Set up the database
createdb qiflow_control_center
psql qiflow_control_center < src/database/schema.sql

# Run tests
npm test

# Start the server
npm run dev
```

**Mobile App Setup** (Future)
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

1. **Install the heartbeat agent on your swarm:**
   ```bash
   pip install -r requirements.txt
   cp settings.ini.example settings.ini
   # Edit settings.ini with your configuration
   ```

2. **Configure `settings.ini`:**
   ```ini
   [heartbeat]
   monitor_url=https://your-backend.com/api/v1/heartbeat
   api_key=your-swarm-api-key
   interval=60
   swarm_id=
   enable_api=true
   api_port=8080

   [project_tracking]
   enabled=true
   github_repo=owner/repo
   github_token=
   flag_blocked_after_hours=24
   flag_failures_threshold=3
   flag_test_failure_rate=0.10
   ```

3. **Start the heartbeat agent and API server:**
   ```bash
   python -m core.heartbeat &       # Start heartbeat daemon
   python -m core.api_server &      # Start API server on port 8080
   ```

The swarm exposes the following local API endpoints (see `docs/heartbeat-agent.md` for full details):
- `GET http://swarm-host:8080/health` - Health check
- `GET http://swarm-host:8080/status` - Current status and metrics
- `GET http://swarm-host:8080/project/completion` - Project completion data
- `GET http://swarm-host:8080/project/issues` - Issue list with filters
- `GET http://swarm-host:8080/metrics` - All collected metrics
- `GET http://swarm-host:8080/agent/status` - Agent configuration

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
- Backend API: >85% coverage (currently achieved)
- Mobile App: >75% coverage
- All critical user flows covered by E2E tests

**E2E Test Suite** ✅
- Comprehensive Python-based E2E tests (`tests/test_api_integration.py`)
- Tests all swarm management endpoints (register, list, detail, delete)
- Tests intervention flagging system endpoints
- Tests caching behavior and invalidation
- Tests error handling and validation
- Run with: `pytest tests/test_api_integration.py -v`

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
- Check existing documentation:
  - `README.md` - Project overview and setup
  - `API.md` - Human Intervention API documentation
  - `docs/heartbeat-agent.md` - Swarm Heartbeat Agent documentation

---

**Status**: 🚧 Under Active Development
**Version**: Pre-release (v1.0 in progress)
**Last Updated**: 2025-10-02
