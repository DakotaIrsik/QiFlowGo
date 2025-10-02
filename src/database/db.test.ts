import { Pool, QueryResult } from 'pg';
import { query, getClient, endPool } from './db';

// Mock the pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return {
    Pool: jest.fn(() => mPool),
  };
});

describe('Database Module', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked pool instance
    mockPool = new Pool();
  });

  describe('query', () => {
    it('should execute a query and return results', async () => {
      const mockResult: QueryResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(1);
    });

    it('should execute a query without parameters', async () => {
      const mockResult: QueryResult = {
        rows: [{ count: 10 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT COUNT(*) as count FROM users');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users', undefined);
      expect(result.rows[0].count).toBe(10);
    });

    it('should log query execution details in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      await query('SELECT * FROM test');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: 'SELECT * FROM test',
          duration: expect.any(Number),
          rows: 0,
        })
      );

      consoleLogSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log query details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      await query('SELECT * FROM test');

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'Executed query',
        expect.anything()
      );

      consoleLogSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle query errors', async () => {
      const error = new Error('Connection lost');
      mockPool.query.mockRejectedValue(error);

      await expect(query('SELECT * FROM invalid')).rejects.toThrow('Connection lost');
    });

    it('should measure query duration', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      // Simulate slow query
      mockPool.query.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockResult;
      });

      await query('SELECT * FROM slow_table');

      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[1].duration).toBeGreaterThanOrEqual(0);

      consoleLogSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle multiple concurrent queries', async () => {
      const mockResult: QueryResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const queries = [
        query('SELECT * FROM table1'),
        query('SELECT * FROM table2'),
        query('SELECT * FROM table3'),
      ];

      const results = await Promise.all(queries);

      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.rows).toHaveLength(1);
      });
    });
  });

  describe('getClient', () => {
    it('should return a database client', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient);

      const client = await getClient();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toEqual(mockClient);
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(getClient()).rejects.toThrow('Connection failed');
    });

    it('should return independent clients for concurrent requests', async () => {
      const mockClient1 = { id: 1, query: jest.fn(), release: jest.fn() };
      const mockClient2 = { id: 2, query: jest.fn(), release: jest.fn() };

      mockPool.connect
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2);

      const [client1, client2] = await Promise.all([getClient(), getClient()]);

      expect(mockPool.connect).toHaveBeenCalledTimes(2);
      expect(client1).not.toBe(client2);
    });
  });

  describe('endPool', () => {
    it('should close the connection pool', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await endPool();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle pool closure errors', async () => {
      const error = new Error('Failed to close pool');
      mockPool.end.mockRejectedValue(error);

      await expect(endPool()).rejects.toThrow('Failed to close pool');
    });

    it('should allow multiple calls to endPool', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await endPool();
      await endPool();

      expect(mockPool.end).toHaveBeenCalledTimes(2);
    });
  });

  describe('Pool Configuration', () => {
    it('should configure pool with environment variables', () => {
      // The pool is created when the module is imported
      // We can verify it was called with the Pool constructor
      expect(Pool).toHaveBeenCalled();
    });

    it('should handle pool errors', () => {
      const errorHandler = mockPool.on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      );

      expect(errorHandler).toBeDefined();
      if (errorHandler) {
        expect(errorHandler[0]).toBe('error');
        expect(typeof errorHandler[1]).toBe('function');
      }
    });

    it('should call process.exit on pool error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const errorHandlerCall = mockPool.on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      );

      expect(errorHandlerCall).toBeDefined();
      if (errorHandlerCall) {
        const errorHandler = errorHandlerCall[1];
        const testError = new Error('Pool error');

        expect(() => errorHandler(testError)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error on idle client', testError);
        expect(processExitSpy).toHaveBeenCalledWith(-1);
      }

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result sets', async () => {
      const mockResult: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM empty_table');

      expect(result.rows).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it('should handle large result sets', async () => {
      const largeRows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const mockResult: QueryResult = {
        rows: largeRows,
        rowCount: 1000,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM large_table');

      expect(result.rows).toHaveLength(1000);
      expect(result.rowCount).toBe(1000);
    });

    it('should handle queries with null parameters', async () => {
      const mockResult: QueryResult = {
        rows: [{ id: 1, value: null }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM test WHERE value = $1', [null]);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE value = $1',
        [null]
      );
      expect(result.rows[0].value).toBeNull();
    });

    it('should handle queries with array parameters', async () => {
      const mockResult: QueryResult = {
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM test WHERE id = ANY($1)', [[1, 2, 3]]);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ANY($1)',
        [[1, 2, 3]]
      );
      expect(result.rows).toHaveLength(3);
    });

    it('should handle transaction-style queries', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockResults: QueryResult[] = [
        {
          rows: [],
          rowCount: 0,
          command: 'BEGIN',
          oid: 0,
          fields: [],
        },
        {
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        },
        {
          rows: [],
          rowCount: 0,
          command: 'COMMIT',
          oid: 0,
          fields: [],
        },
      ];

      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2]);

      const client = await getClient();

      await client.query('BEGIN');
      const insertResult = await client.query('INSERT INTO test (id) VALUES (1) RETURNING *');
      await client.query('COMMIT');
      client.release();

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(insertResult.rows[0].id).toBe(1);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
