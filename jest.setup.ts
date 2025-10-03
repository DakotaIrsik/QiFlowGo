// Global setup for all Jest tests
// This file is executed before any tests run

// Set environment to test mode
process.env.NODE_ENV = 'test';
process.env.API_KEY_SECRET = 'test-api-key-secret';

// Mock database environment variables to prevent actual connections
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'qiflow_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

// Increase test timeout for integration tests
jest.setTimeout(10000);
