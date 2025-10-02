# QiFlow Control Center

A mobile command center for managing multiple QiFlow AI swarm deployments across VMs, Raspberry Pis, and cloud instances.

## Overview

QiFlow Control Center is a centralized monitoring and management platform that provides real-time visibility and control over distributed QiFlow swarm deployments. It combines a React Native mobile app with a Node.js backend to deliver a comprehensive fleet management solution for autonomous AI development teams.

## Key Features

### 📱 Mobile Command Center
- **Fleet Dashboard**: Real-time overview of all registered swarms with status, health metrics, and quick actions
- **Swarm Detail View**: Deep dive into individual swarms with live activity feeds, agent status, resource metrics, and issue boards
- **Push Notifications**: Configurable alerts for critical events (swarm offline, API quota exhausted, disk critical)
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
- Real-time telemetry (60-second intervals)
- Automatic alert detection and escalation

### System Components

1. **Swarm Heartbeat Agent** (`core/heartbeat.py`)
   - Runs on each QiFlow swarm deployment
   - Sends real-time status updates every 60 seconds
   - Collects system metrics, agent status, GitHub activity, and resource usage

2. **Monitoring API Service**
   - Central backend receiving heartbeat data
   - Stores metrics in Firebase Realtime Database
   - Detects missed heartbeats and triggers alerts
   - Rate limiting (100 req/min per swarm)

3. **GitHub Integration Service**
   - GitHub App with webhook handlers
   - Caches data to avoid rate limits (5-minute TTL)
   - Aggregates commits, PRs, issues, and test results
   - Real-time activity updates via webhooks

4. **Host Management & Remote Control**
   - SSH connection pool for remote operations
   - Whitelisted commands (restart, update, logs)
   - Host registration and capacity validation
   - Audit logging for all actions

## API Endpoints

### Monitoring
- `POST /api/v1/heartbeat` - Receive heartbeat from swarms
- `GET /api/v1/swarms` - List all registered swarms
- `GET /api/v1/swarms/:swarm_id` - Get swarm details
- `POST /api/v1/swarms/:swarm_id/control` - Execute control actions

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

## Deployment Flow

1. **Select Host**: Choose from registered hosts
2. **Select Repository**: GitHub OAuth flow to select repository
3. **Choose Schedule**: Apply preset or custom cron schedule
4. **Configure Agents**: Define agent roles and responsibilities
5. **Customer/Billing**: Link to customer and billing information
6. **Deploy**: Automated installation and post-deployment validation

## Development Milestones

### QiFlow Control Center v1.0
**Critical Features**
- ✅ Project setup and infrastructure
- 🔄 Swarm heartbeat agent module
- 🔄 Monitoring API service
- 🔄 Mobile authentication & onboarding
- 🔄 Dashboard (fleet overview)
- 🔄 Swarm detail view
- 🔄 Swarm control actions
- 🔄 Push notifications & alerts
- 🔄 Host management & remote control

**High Priority Features**
- 🔄 GitHub integration service
- 🔄 End-to-end test suite
- 🔄 Security audit & penetration testing

**Medium Priority Features**
- 🔄 Swarm deployment wizard
- 🔄 Customer & project management
- 🔄 Analytics & insights
- 🔄 SSH quick connect
- 🔄 Documentation & setup guide

### QiFlow Control Center v2.0
- Multi-swarm batch operations
- Advanced analytics and forecasting
- Custom dashboard builder

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
```

## Security Considerations

- **Never expose SSH credentials** in configuration files or logs
- **Firebase security rules** must validate authentication and authorization
- **Rate limiting** prevents API abuse (100 req/min per swarm)
- **Command whitelist** restricts remote operations to safe commands
- **Audit logging** captures all control actions for compliance
- **JWT tokens** expire after configurable period (default: 24 hours)
- **Biometric authentication** optional for mobile app access

## Testing

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
