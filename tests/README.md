# QiFlow Control Center - Test Suite

## Overview

This directory contains the comprehensive end-to-end test suite for the QiFlow Control Center backend API. The test suite covers API endpoints, database operations, services, and integration scenarios.

## Test Structure

```
tests/
├── integration/          # Integration tests for routes and cross-component testing
│   └── interventionRoutes.test.ts
├── test_api_integration.py  # Python API integration tests
├── test_heartbeat.py        # Heartbeat monitoring tests
└── README.md                # This file

src/
├── app.test.ts              # E2E tests for the Express application
├── database/
│   └── db.test.ts          # Database connection and query tests
├── models/
│   ├── InterventionFlagModel.test.ts           # Unit tests for intervention flags
│   └── InterventionFlagModel.integration.test.ts # Integration tests
├── routes/
│   ├── interventionRoutes.test.ts  # Route handler tests
│   └── swarmRoutes.test.ts         # Swarm route tests
└── services/
    ├── cacheService.test.ts         # Cache service tests
    ├── cronService.test.ts          # Cron job tests
    ├── flaggingService.test.ts      # Flagging logic tests
    └── notificationService.test.ts  # Notification tests
```

## Running Tests

### Run all tests with coverage
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run only specific test files
```bash
npm test -- app.test.ts
npm test -- --testPathPattern=routes
```

### Type checking
```bash
npm run lint
```

## Test Coverage

Current coverage targets:
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

Coverage reports are generated in the `coverage/` directory.

### Viewing Coverage Reports
```bash
# Generate coverage
npm test

# Open HTML report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html  # Windows
xdg-open coverage/lcov-report/index.html  # Linux
```

## Test Categories

### 1. Unit Tests
Test individual functions and methods in isolation with mocked dependencies.

**Examples:**
- `src/services/flaggingService.test.ts`
- `src/models/InterventionFlagModel.test.ts`

### 2. Integration Tests
Test multiple components working together, including database operations.

**Examples:**
- `src/models/InterventionFlagModel.integration.test.ts`
- `backend/tests/integration/interventionRoutes.test.ts`

### 3. E2E Tests
Test complete user flows through the API.

**Examples:**
- `src/app.test.ts` - Full application tests including middleware, routing, and error handling

### 4. Route Tests
Test HTTP endpoints with mocked dependencies.

**Examples:**
- `src/routes/swarmRoutes.test.ts`
- `src/routes/interventionRoutes.test.ts`

## Writing New Tests

### Test File Naming
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `app.test.ts` or `e2e/*.test.ts`

### Example Test Structure
```typescript
import request from 'supertest';
import app from '../app';

// Mock dependencies
jest.mock('../database/db');
jest.mock('../models/YourModel');

describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Specific Functionality', () => {
    it('should do something specific', async () => {
      // Arrange
      const mockData = { id: 1, name: 'test' };

      // Act
      const response = await request(app)
        .get('/api/v1/endpoint')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });
});
```

## Mocking Strategy

### Database Mocks
```typescript
jest.mock('../database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));
```

### Model Mocks
```typescript
jest.mock('../models/SwarmModel', () => ({
  SwarmModel: {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));
```

## CI/CD Integration

Tests run automatically in the CI/CD pipeline on:
- Pull requests
- Commits to main/master
- Manual triggers

### Pipeline Requirements
- All tests must pass
- Coverage thresholds must be met
- No TypeScript errors

## Performance Tests

Performance baselines are established for critical endpoints:
- Health check: < 100ms
- List swarms: < 500ms
- Get swarm details: < 200ms

## Troubleshooting

### Common Issues

**Tests timing out:**
- Increase timeout in `jest.config.js` (current: 10000ms)
- Check for missing async/await
- Verify mocks are properly configured

**Coverage not meeting threshold:**
- Check `coverage/lcov-report/index.html` for uncovered lines
- Add tests for edge cases
- Verify test files are not excluded in `jest.config.js`

**Module not found errors:**
- Run `npm install`
- Clear jest cache: `npm test -- --clearCache`

## Best Practices

1. **Test Independence**: Each test should be able to run independently
2. **Clear Mocks**: Always clear mocks in `beforeEach` hooks
3. **Descriptive Names**: Use clear, descriptive test names
4. **Arrange-Act-Assert**: Follow the AAA pattern
5. **Test Edge Cases**: Don't just test happy paths
6. **Avoid Test Interdependence**: Tests should not rely on execution order
7. **Mock External Dependencies**: Don't make real API calls or database queries in unit tests

## Contributing

When adding new features:
1. Write tests first (TDD approach preferred)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this README if adding new test categories
