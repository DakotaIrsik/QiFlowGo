# QiFlow Control Center - Administrator Guide

## Introduction

This guide is for administrators who deploy, configure, and maintain QiFlow Control Center infrastructure. It covers backend setup, user management, security configuration, and operational procedures.

## System Architecture

### Components Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Mobile Apps (iOS/Android)               │
│                   - React Native                          │
│                   - Firebase Auth Client                  │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS/WSS
┌────────────────────┴─────────────────────────────────────┐
│              Central Backend API (Node.js/Express)        │
│              - JWT Authentication                         │
│              - Rate Limiting                              │
│              - Caching Layer (15-30s TTL)                 │
│              - Background Polling Service                 │
└────────┬────────────────────────┬──────────────┬─────────┘
         │                        │              │
         ▼                        ▼              ▼
┌────────────────┐    ┌─────────────────┐   ┌──────────────┐
│   PostgreSQL   │    │ Firebase Realtime│  │ GitHub API   │
│   - Users      │    │   Database       │  │ - Issues     │
│   - Swarms     │    │ - Real-time data │  │ - PRs        │
│   - Metrics    │    │ - Notifications  │  │ - Commits    │
└────────────────┘    └─────────────────┘   └──────────────┘
         ▲
         │ Poll every 30s
┌────────┴─────────────────────────────────────────────────┐
│          Swarm Hosts (Distributed)                        │
│          - Python Heartbeat Agent                         │
│          - Flask API Server (port 8080)                   │
│          - QiFlow Swarm Runtime                           │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Heartbeat Collection**:
   - Each swarm host runs heartbeat agent
   - Sends status to backend every 60 seconds
   - Exposes local API on port 8080

2. **Continuous Polling**:
   - Backend polls each swarm host API every 30s
   - Collects metrics, agent status, project completion
   - Caches responses with 15-30s TTL

3. **Mobile App Polling**:
   - Dashboard polls backend every 30s
   - Detail view polls backend every 15s
   - Uses cached responses for performance

4. **Real-time Updates**:
   - Firebase Realtime Database for instant notifications
   - Push notifications via FCM
   - WebSocket fallback for compatibility

## Backend Deployment

### Prerequisites

**System Requirements:**
- **OS**: Ubuntu 20.04+ / Debian 11+ / macOS / Windows with WSL
- **Node.js**: 18.x or 20.x
- **PostgreSQL**: 14+
- **Memory**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **Network**: Public IP with ports 80, 443, 5432 accessible

**Required Services:**
- Firebase project (Auth, Realtime Database, Cloud Messaging)
- GitHub App or Personal Access Token
- SSL certificate (Let's Encrypt recommended)

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/QiFlowGo.git
cd QiFlowGo
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Database Setup

```bash
# Create database
sudo -u postgres createdb qiflow_control_center

# Create database user
sudo -u postgres createuser qiflow_user -P

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE qiflow_control_center TO qiflow_user;"

# Run migrations
npm run migrate
```

#### 4. Configure Environment

Create `.env` file:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://qiflow_user:password@localhost:5432/qiflow_control_center

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# GitHub Integration
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----\n...'
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Security
JWT_SECRET=your-secure-random-secret-key
API_KEY_SALT=your-api-key-salt

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Caching
CACHE_TTL_SWARMS_LIST=30
CACHE_TTL_SWARM_DETAIL=15

# Polling Configuration
SWARM_POLLING_INTERVAL=30000
SWARM_POLLING_TIMEOUT=5000
SWARM_OFFLINE_THRESHOLD=90000
```

#### 5. Build and Start

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/server.js --name qiflow-backend
pm2 save
pm2 startup
```

### Reverse Proxy Configuration

#### Nginx

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Apache

```apache
<VirtualHost *:80>
    ServerName api.yourdomain.com
    Redirect permanent / https://api.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName api.yourdomain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.yourdomain.com/privkey.pem

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

## Firebase Configuration

### Project Setup

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Follow wizard (disable Google Analytics if not needed)

2. **Enable Authentication**
   - Navigate to Authentication → Sign-in method
   - Enable Email/Password provider
   - Optionally enable 2FA

3. **Set Up Realtime Database**
   - Navigate to Realtime Database → Create Database
   - Start in locked mode
   - Apply security rules (see below)

4. **Configure Cloud Messaging**
   - Navigate to Project Settings → Cloud Messaging
   - Note Server Key for backend
   - Download config files for mobile apps

### Security Rules

**Realtime Database Rules:**

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "swarms": {
      "$swarm_id": {
        ".read": "auth != null",
        ".write": "root.child('users').child(auth.uid).child('is_admin').val() === true"
      }
    },
    "users": {
      "$user_id": {
        ".read": "auth.uid === $user_id || root.child('users').child(auth.uid).child('is_admin').val() === true",
        ".write": "auth.uid === $user_id || root.child('users').child(auth.uid).child('is_admin').val() === true"
      }
    }
  }
}
```

### Service Account Setup

1. Navigate to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save JSON file securely
4. Convert to single-line JSON for `.env`:

```bash
cat service-account.json | jq -c . | sed 's/"/\\"/g'
```

5. Add to `.env` as `FIREBASE_SERVICE_ACCOUNT_KEY`

## GitHub Integration

### Creating a GitHub App

1. **Navigate to GitHub** → Settings → Developer settings → GitHub Apps
2. **Click** "New GitHub App"
3. **Configure**:
   - Name: "QiFlow Control Center"
   - Homepage URL: https://yourdomain.com
   - Webhook URL: https://api.yourdomain.com/api/v1/github/webhook
   - Webhook secret: Generate secure random string
   - Permissions:
     - Repository permissions:
       - Contents: Read
       - Issues: Read & Write
       - Pull requests: Read
       - Metadata: Read
     - Subscribe to events:
       - Commit
       - Pull request
       - Issues
       - Check suite
4. **Generate Private Key** and download
5. **Install App** on repositories you want to monitor

### Webhook Configuration

Add webhook secret to `.env`:

```env
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

Verify webhook is receiving events:

```bash
curl -X POST https://api.yourdomain.com/api/v1/github/webhook \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "Content-Type: application/json" \
  -d '{"action":"ping"}'
```

## User Management

### Creating Admin Users

**Via CLI:**

```bash
npm run create-admin -- --email admin@example.com --password SecurePassword123
```

**Via Database:**

```sql
-- Find user by email
SELECT id, firebase_uid, email, is_admin FROM users WHERE email = 'user@example.com';

-- Grant admin privileges
UPDATE users SET is_admin = true WHERE firebase_uid = 'firebase-uid-here';
```

**Via API:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/admin/grant \
  -H "Authorization: Bearer admin-firebase-token" \
  -H "Content-Type: application/json" \
  -d '{"uid":"firebase-uid-here"}'
```

### Revoking Access

```sql
-- Revoke admin privileges
UPDATE users SET is_admin = false WHERE firebase_uid = 'firebase-uid-here';

-- Disable user account
UPDATE users SET disabled = true WHERE firebase_uid = 'firebase-uid-here';
```

### User Audit Logs

Query user activity:

```sql
SELECT * FROM audit_logs
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 100;
```

## Swarm Registration

### Manual Registration

**Via API:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/swarms \
  -H "Authorization: Bearer firebase-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Swarm",
    "host_url": "http://swarm-host.example.com:8080",
    "github_repo": "owner/repo",
    "customer_id": "customer-uuid",
    "metadata": {
      "environment": "production",
      "region": "us-east-1"
    }
  }'
```

**Via Database:**

```sql
INSERT INTO swarms (id, name, host_url, github_repo, customer_id, created_at)
VALUES (
  gen_random_uuid(),
  'Production Swarm',
  'http://swarm-host.example.com:8080',
  'owner/repo',
  'customer-uuid-here',
  NOW()
);
```

### Verifying Swarm Connection

```bash
# Test swarm host API
curl http://swarm-host.example.com:8080/health

# Check backend polling
curl https://api.yourdomain.com/api/v1/swarms/swarm-id-here \
  -H "Authorization: Bearer firebase-token"
```

## Monitoring & Maintenance

### Health Checks

**Backend Health:**

```bash
curl https://api.yourdomain.com/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-04T12:00:00Z",
  "database": "connected",
  "firebase": "connected"
}
```

**Swarm Health:**

```bash
curl https://api.yourdomain.com/api/v1/swarms/health-check \
  -H "Authorization: Bearer admin-token"
```

### Log Management

**View Backend Logs:**

```bash
# PM2 logs
pm2 logs qiflow-backend

# Tail recent logs
tail -f /var/log/qiflow/backend.log

# Search for errors
grep ERROR /var/log/qiflow/backend.log
```

**View Swarm Logs:**

```bash
# SSH into swarm host
ssh user@swarm-host.example.com

# View heartbeat logs
tail -f heartbeat.log

# View API server logs
tail -f api_server.log
```

### Database Maintenance

**Backup:**

```bash
# Daily backup
pg_dump qiflow_control_center > backup_$(date +%Y%m%d).sql

# Automated backup script
0 2 * * * /usr/bin/pg_dump qiflow_control_center | gzip > /backups/qiflow_$(date +\%Y\%m\%d).sql.gz
```

**Restore:**

```bash
# Restore from backup
psql qiflow_control_center < backup_20251004.sql
```

**Vacuum:**

```bash
# Reclaim space and update statistics
psql qiflow_control_center -c "VACUUM ANALYZE;"
```

### Performance Tuning

**PostgreSQL Configuration:**

Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
max_connections = 100
```

**Cache Optimization:**

Adjust cache TTL in `.env`:

```env
# Increase for less frequent updates (reduces load)
CACHE_TTL_SWARMS_LIST=60

# Decrease for more real-time updates (increases load)
CACHE_TTL_SWARM_DETAIL=10
```

**Polling Optimization:**

```env
# Increase interval to reduce load on swarm hosts
SWARM_POLLING_INTERVAL=60000

# Decrease timeout for faster failure detection
SWARM_POLLING_TIMEOUT=3000
```

## Security

### SSL/TLS Configuration

**Let's Encrypt:**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (cron)
0 3 * * * certbot renew --quiet
```

### Firewall Rules

**UFW (Ubuntu):**

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (internal only)
sudo ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
sudo ufw enable
```

### API Key Rotation

```bash
# Generate new API key
npm run generate-api-key

# Update swarm configuration
# Update .env with new JWT_SECRET (requires restart)

# Revoke old keys
npm run revoke-api-key -- --key old-key-here
```

### Audit Logging

Enable comprehensive audit logs:

```env
ENABLE_AUDIT_LOGS=true
AUDIT_LOG_LEVEL=info
```

Query audit logs:

```sql
SELECT * FROM audit_logs
WHERE action = 'swarm.control.emergency_stop'
ORDER BY created_at DESC;
```

## Troubleshooting

### Backend Won't Start

**Check logs:**

```bash
pm2 logs qiflow-backend --lines 100
```

**Common issues:**
- Database connection failed → Verify `DATABASE_URL`
- Firebase initialization failed → Verify `FIREBASE_SERVICE_ACCOUNT_KEY`
- Port already in use → Change `PORT` or kill process

### Swarms Showing Offline

**Diagnose:**

```bash
# Test swarm host connectivity
curl http://swarm-host:8080/health

# Check firewall
telnet swarm-host 8080

# Check polling service
pm2 logs qiflow-backend | grep "Polling swarm"
```

**Solutions:**
- Restart heartbeat agent on swarm host
- Verify firewall allows port 8080
- Check `SWARM_OFFLINE_THRESHOLD` in `.env`

### High Memory Usage

**Check memory:**

```bash
pm2 list
htop
```

**Solutions:**
- Increase `CACHE_TTL` to reduce cache churn
- Reduce `SWARM_POLLING_INTERVAL` frequency
- Restart backend: `pm2 restart qiflow-backend`
- Add swap space if needed

### Database Connection Pool Exhausted

**Error**: "Sorry, too many clients already"

**Solutions:**

```env
# Reduce max connections in .env
DATABASE_POOL_MAX=20

# Or increase PostgreSQL max_connections
sudo nano /etc/postgresql/14/main/postgresql.conf
# max_connections = 200
sudo systemctl restart postgresql
```

## Scaling

### Horizontal Scaling

**Load Balancer Configuration (Nginx):**

```nginx
upstream qiflow_backend {
    least_conn;
    server backend1.internal:3000;
    server backend2.internal:3000;
    server backend3.internal:3000;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://qiflow_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Read Replicas

```env
# Primary database (writes)
DATABASE_URL=postgresql://user:pass@primary:5432/qiflow

# Read replicas (reads)
DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/qiflow
```

### Caching Layer (Redis)

```bash
# Install Redis
sudo apt install redis-server

# Configure in .env
REDIS_URL=redis://localhost:6379
ENABLE_REDIS_CACHE=true
```

## Backup & Disaster Recovery

### Automated Backup Script

```bash
#!/bin/bash
# /usr/local/bin/qiflow-backup.sh

BACKUP_DIR="/backups/qiflow"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump qiflow_control_center | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Configuration backup
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /opt/qiflow/.env /opt/qiflow/settings.ini

# Retain last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/qiflow/
```

### Disaster Recovery Plan

1. **Database Failure**:
   - Restore from latest backup
   - Point backend to read replica (if available)
   - Notify users of read-only mode

2. **Backend Failure**:
   - Redeploy from GitHub
   - Restore `.env` from backup
   - Verify health endpoints

3. **Complete System Failure**:
   - Provision new infrastructure
   - Restore database from backup
   - Redeploy backend
   - Re-register swarms
   - Notify users of downtime

## Support & Escalation

### Support Tiers

**Tier 1: User Support**
- Mobile app issues
- Login problems
- General usage questions
- Documentation: User Guide

**Tier 2: Operations**
- Swarm connectivity
- Performance issues
- Configuration changes
- Documentation: This Admin Guide

**Tier 3: Engineering**
- Backend bugs
- Security incidents
- Database corruption
- Architecture changes

### Incident Response

1. **Detection**: Alert triggered
2. **Assessment**: Severity level (P0-P4)
3. **Mitigation**: Immediate fixes
4. **Resolution**: Root cause analysis
5. **Postmortem**: Document lessons learned

---

**Version**: 1.0
**Last Updated**: 2025-10-04
