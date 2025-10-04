# QiFlow Control Center - Developer Guide

## Introduction

This guide is for developers who want to contribute to QiFlow Control Center, extend its functionality, or integrate it with other systems. It covers the codebase structure, development workflow, API integration, and best practices.

## Development Environment Setup

### Prerequisites

- **Node.js** 18.x or 20.x
- **npm** 8+ or **yarn** 1.22+
- **PostgreSQL** 14+
- **Git** 2.30+
- **Python** 3.8+ (for swarm heartbeat agent)
- **IDE**: VS Code, WebStorm, or similar with TypeScript support

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/QiFlowGo.git
cd QiFlowGo

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Create database
createdb qiflow_control_center_dev

# Run migrations
npm run migrate

# Run tests
npm test

# Start development server
npm run dev
```

### VS Code Configuration

Recommended extensions:
- **ESLint** - Microsoft
- **Prettier** - Prettier
- **Jest** - Orta
- **TypeScript Import Sorter** - Mike Hanson
- **REST Client** - Huachao Mao

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "jest.autoRun": "off"
}
```

## Project Structure

```
QiFlowGo/
├── src/
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # Server entry point
│   ├── routes/                   # API route handlers
│   │   ├── swarmRoutes.ts        # Swarm management endpoints
│   │   ├── authRoutes.ts         # Authentication endpoints
│   │   ├── interventionRoutes.ts # Human intervention endpoints
│   │   ├── hostRoutes.ts         # Host management endpoints
│   │   └── githubRoutes.ts       # GitHub webhook handlers
│   ├── services/                 # Business logic
│   │   ├── swarmPollingService.ts   # Background polling
│   │   ├── velocityService.ts       # Velocity calculations
│   │   ├── firebaseAuthService.ts   # Firebase integration
│   │   ├── githubService.ts         # GitHub API client
│   │   └── sshConnectionPool.ts     # SSH connection management
│   ├── models/                   # Database models
│   │   ├── SwarmModel.ts         # Swarm registry
│   │   ├── UserModel.ts          # User management
│   │   ├── VelocityMetricsModel.ts # Velocity tracking
│   │   └── InterventionModel.ts  # Intervention flags
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts               # Authentication
│   │   ├── rateLimiter.ts        # Rate limiting
│   │   ├── errorHandler.ts       # Error handling
│   │   └── requestLogger.ts      # Request logging
│   ├── database/                 # Database utilities
│   │   ├── db.ts                 # Connection pool
│   │   └── migrations/           # Schema migrations
│   └── types/                    # TypeScript type definitions
│       ├── api.ts                # API types
│       ├── swarm.ts              # Swarm types
│       └── github.ts             # GitHub types
├── core/                         # Python heartbeat agent
│   ├── heartbeat.py              # Heartbeat daemon
│   ├── api_server.py             # Flask API server
│   └── metrics_collector.py     # Metrics collection
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── docs/                         # Documentation
├── .github/workflows/            # CI/CD pipelines
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── jest.config.js                # Jest config
```

## Development Workflow

### Creating a Feature

```bash
# Create feature branch
git checkout -b feature/issue-123-feature-name

# Make changes
# ... edit files ...

# Run tests
npm test

# Lint code
npm run lint

# Commit changes
git commit -m "Add feature description (#123)"

# Push branch
git push origin feature/issue-123-feature-name

# Create pull request on GitHub
```

### Code Style

**TypeScript Style Guide:**

```typescript
// Use explicit types
function getSwarmById(id: string): Promise<Swarm> {
  return swarmModel.findById(id);
}

// Use async/await over promises
async function fetchSwarmData(id: string): Promise<SwarmData> {
  const swarm = await swarmModel.findById(id);
  const metrics = await metricsService.getMetrics(swarm.host_url);
  return { swarm, metrics };
}

// Use destructuring
const { name, host_url, github_repo } = req.body;

// Use const/let, never var
const API_VERSION = 'v1';
let retryCount = 0;

// Use arrow functions for callbacks
swarms.map((swarm) => swarm.name);

// Use template literals
const message = `Swarm ${swarmId} is offline`;

// Use interfaces for complex types
interface SwarmMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}
```

**Naming Conventions:**

- **Files**: camelCase for TS files (e.g., `swarmRoutes.ts`)
- **Classes**: PascalCase (e.g., `SwarmModel`)
- **Functions**: camelCase (e.g., `getSwarmById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Interfaces**: PascalCase with I prefix (e.g., `ISwarmConfig`)

### Testing

**Unit Tests:**

```typescript
// swarmService.test.ts
import { SwarmService } from './swarmService';

describe('SwarmService', () => {
  let swarmService: SwarmService;

  beforeEach(() => {
    swarmService = new SwarmService();
  });

  test('should fetch swarm by ID', async () => {
    const swarmId = 'test-swarm-001';
    const swarm = await swarmService.getById(swarmId);

    expect(swarm).toBeDefined();
    expect(swarm.id).toBe(swarmId);
  });

  test('should throw error for invalid ID', async () => {
    await expect(swarmService.getById('invalid')).rejects.toThrow('Swarm not found');
  });
});
```

**Integration Tests:**

```typescript
// swarmRoutes.test.ts
import request from 'supertest';
import { app } from '../app';

describe('Swarm Routes', () => {
  test('GET /api/v1/swarms should return swarms list', async () => {
    const response = await request(app)
      .get('/api/v1/swarms')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('POST /api/v1/swarms should create swarm', async () => {
    const newSwarm = {
      name: 'Test Swarm',
      host_url: 'http://localhost:8080',
      github_repo: 'owner/repo'
    };

    const response = await request(app)
      .post('/api/v1/swarms')
      .set('Authorization', 'Bearer test-token')
      .send(newSwarm)
      .expect(201);

    expect(response.body.data.name).toBe('Test Swarm');
  });
});
```

**E2E Tests:**

```python
# tests/test_api_integration.py
import requests

def test_swarm_registration_flow():
    # Register swarm
    response = requests.post(
        'http://localhost:3000/api/v1/swarms',
        headers={'Authorization': 'Bearer test-token'},
        json={
            'name': 'E2E Test Swarm',
            'host_url': 'http://localhost:8080',
            'github_repo': 'owner/repo'
        }
    )
    assert response.status_code == 201
    swarm_id = response.json()['data']['id']

    # Fetch swarm
    response = requests.get(
        f'http://localhost:3000/api/v1/swarms/{swarm_id}',
        headers={'Authorization': 'Bearer test-token'}
    )
    assert response.status_code == 200
    assert response.json()['data']['name'] == 'E2E Test Swarm'

    # Delete swarm
    response = requests.delete(
        f'http://localhost:3000/api/v1/swarms/{swarm_id}',
        headers={'Authorization': 'Bearer test-token'}
    )
    assert response.status_code == 200
```

**Running Tests:**

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific test file
npm test -- swarmRoutes.test.ts

# E2E tests (Python)
pytest tests/test_api_integration.py -v
```

## API Development

### Creating a New Endpoint

**1. Define Route:**

```typescript
// src/routes/newFeatureRoutes.ts
import { Router } from 'express';
import { authenticateFirebase } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { NewFeatureController } from '../controllers/newFeatureController';

const router = Router();
const controller = new NewFeatureController();

router.get(
  '/api/v1/new-feature',
  authenticateFirebase,
  rateLimiter,
  controller.list
);

router.post(
  '/api/v1/new-feature',
  authenticateFirebase,
  rateLimiter,
  controller.create
);

export default router;
```

**2. Create Controller:**

```typescript
// src/controllers/newFeatureController.ts
import { Request, Response, NextFunction } from 'express';
import { NewFeatureService } from '../services/newFeatureService';

export class NewFeatureController {
  private service: NewFeatureService;

  constructor() {
    this.service = new NewFeatureService();
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getAll();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, value } = req.body;
      const result = await this.service.create(name, value);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
```

**3. Create Service:**

```typescript
// src/services/newFeatureService.ts
export class NewFeatureService {
  async getAll(): Promise<any[]> {
    // Business logic here
    return [];
  }

  async create(name: string, value: string): Promise<any> {
    // Business logic here
    return { name, value };
  }
}
```

**4. Register Route:**

```typescript
// src/app.ts
import newFeatureRoutes from './routes/newFeatureRoutes';

app.use(newFeatureRoutes);
```

**5. Write Tests:**

```typescript
// src/routes/newFeatureRoutes.test.ts
import request from 'supertest';
import { app } from '../app';

describe('New Feature Routes', () => {
  test('GET /api/v1/new-feature should return list', async () => {
    const response = await request(app)
      .get('/api/v1/new-feature')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### Database Migrations

**Creating a Migration:**

```typescript
// src/database/migrations/001_create_new_table.ts
import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE new_table (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_new_table_name ON new_table(name);
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS new_table CASCADE;');
}
```

**Running Migrations:**

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:create -- --name create_new_table
```

### Adding a Background Service

```typescript
// src/services/backgroundTaskService.ts
import cron from 'node-cron';

export class BackgroundTaskService {
  private task: cron.ScheduledTask | null = null;

  start(): void {
    // Run every hour
    this.task = cron.schedule('0 * * * *', async () => {
      console.log('Running background task...');
      await this.performTask();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
    }
  }

  private async performTask(): Promise<void> {
    // Task logic here
  }
}

// In server.ts
import { BackgroundTaskService } from './services/backgroundTaskService';

const backgroundTask = new BackgroundTaskService();
backgroundTask.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  backgroundTask.stop();
});
```

## Python Heartbeat Agent Development

### Project Structure

```
core/
├── heartbeat.py           # Main daemon
├── api_server.py          # Flask API
├── metrics_collector.py   # Metrics logic
└── utils.py               # Helper functions

tests/
├── test_heartbeat.py      # Heartbeat tests
├── test_api_server.py     # API tests
└── test_metrics.py        # Metrics tests
```

### Extending Metrics Collection

```python
# core/metrics_collector.py
import psutil
from typing import Dict, Any

class MetricsCollector:
    def collect_custom_metric(self) -> Dict[str, Any]:
        """Collect custom application-specific metrics"""
        return {
            'custom_value': self._get_custom_value(),
            'timestamp': datetime.now().isoformat()
        }

    def _get_custom_value(self) -> int:
        # Your custom logic here
        return 42

    def collect_all(self) -> Dict[str, Any]:
        """Collect all metrics including custom ones"""
        return {
            'system': self.collect_system_metrics(),
            'resources': self.collect_resource_metrics(),
            'custom': self.collect_custom_metric()
        }
```

### Adding API Endpoints

```python
# core/api_server.py
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/custom/endpoint', methods=['GET'])
def custom_endpoint():
    """Custom API endpoint"""
    try:
        data = get_custom_data()
        return jsonify({
            'success': True,
            'data': data
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def get_custom_data():
    # Your logic here
    return {'message': 'Custom data'}
```

### Testing Python Code

```python
# tests/test_custom.py
import pytest
from core.metrics_collector import MetricsCollector

def test_custom_metric_collection():
    collector = MetricsCollector()
    metrics = collector.collect_custom_metric()

    assert 'custom_value' in metrics
    assert metrics['custom_value'] == 42
    assert 'timestamp' in metrics
```

```bash
# Run Python tests
pytest tests/ -v

# With coverage
pytest --cov=core --cov-report=html tests/
```

## Mobile App Development

(When mobile app is implemented)

### React Native Setup

```bash
# Clone mobile app repository
git clone https://github.com/your-org/qiflow-mobile.git
cd qiflow-mobile

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### API Integration

```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'https://api.yourdomain.com/api/v1';

export class ApiService {
  private token: string | null = null;

  setAuthToken(token: string): void {
    this.token = token;
  }

  async getSwarms(): Promise<Swarm[]> {
    const response = await axios.get(`${API_BASE_URL}/swarms`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.data.data;
  }

  async getSwarmById(id: string): Promise<Swarm> {
    const response = await axios.get(`${API_BASE_URL}/swarms/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.data.data;
  }
}
```

## CI/CD Integration

### GitHub Actions Workflows

**PR Validation:**

```yaml
# .github/workflows/pr-check.yml
name: Pull Request Validation
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

**Backend Deployment:**

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20.x
      - run: npm ci
      - run: npm run build
      - name: Deploy to production
        run: |
          # Deployment script here
          echo "Deploying to production..."
```

## Debugging

### Backend Debugging (VS Code)

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/server.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Python Debugging

```python
# Add to any file
import pdb; pdb.set_trace()

# Or use ipdb for better experience
import ipdb; ipdb.set_trace()
```

### Logging

```typescript
// Use Winston for structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage
logger.info('Swarm registered', { swarmId: 'test-001' });
logger.error('Failed to poll swarm', { swarmId: 'test-001', error: err.message });
```

## Performance Optimization

### Caching Strategy

```typescript
// Simple in-memory cache
class CacheService {
  private cache = new Map<string, { data: any; expires: number }>();

  set(key: string, data: any, ttl: number): void {
    const expires = Date.now() + ttl * 1000;
    this.cache.set(key, { data, expires });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
```

### Database Query Optimization

```typescript
// Use connection pooling
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Use prepared statements
const query = 'SELECT * FROM swarms WHERE id = $1';
const result = await pool.query(query, [swarmId]);

// Use indexes
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_swarms_github_repo
  ON swarms(github_repo);
`);
```

## Security Best Practices

### Input Validation

```typescript
import Joi from 'joi';

const swarmSchema = Joi.object({
  name: Joi.string().required().max(255),
  host_url: Joi.string().uri().required(),
  github_repo: Joi.string().pattern(/^[\w-]+\/[\w-]+$/).required()
});

export function validateSwarmInput(data: any): void {
  const { error } = swarmSchema.validate(data);
  if (error) {
    throw new Error(`Validation error: ${error.message}`);
  }
}
```

### SQL Injection Prevention

```typescript
// GOOD: Parameterized query
const query = 'SELECT * FROM swarms WHERE name = $1';
await pool.query(query, [swarmName]);

// BAD: String concatenation
const query = `SELECT * FROM swarms WHERE name = '${swarmName}'`; // Never do this!
```

### Environment Variables

```typescript
// Validate required env vars on startup
const requiredEnvVars = [
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'JWT_SECRET'
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

## Contributing Guidelines

### Pull Request Process

1. **Fork** the repository
2. **Create** feature branch from `main`
3. **Write** tests for new functionality
4. **Ensure** all tests pass
5. **Update** documentation
6. **Submit** pull request with clear description
7. **Address** review feedback

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Performance impact considered
- [ ] Backward compatibility maintained
- [ ] Error handling implemented
- [ ] Logging added where appropriate

## Resources

### Documentation
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Express**: https://expressjs.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Firebase**: https://firebase.google.com/docs
- **Jest**: https://jestjs.io/docs/getting-started

### Tools
- **Postman**: API testing
- **DBeaver**: Database management
- **Insomnia**: REST client
- **pgAdmin**: PostgreSQL admin

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Developer discussions
- **Stack Overflow**: Tagged `qiflow-control-center`

---

**Version**: 1.0
**Last Updated**: 2025-10-04
