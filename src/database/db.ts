import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL connection pool
// In test environment, we create a minimal pool configuration
// that won't try to connect until actually used (and should be mocked)
const isTestEnv = process.env.NODE_ENV === 'test';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'qiflow_control_center',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: isTestEnv ? 1 : 20,
  idleTimeoutMillis: isTestEnv ? 1000 : 30000,
  connectionTimeoutMillis: isTestEnv ? 1000 : 2000,
  // In test environment, don't connect on init
  ...(isTestEnv && { allowExitOnIdle: true }),
});

// Handle pool errors (but don't exit in test environment)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (!isTestEnv) {
    process.exit(-1);
  }
});

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }

  return res;
};

export const getClient = async () => {
  return await pool.connect();
};

export const endPool = async () => {
  await pool.end();
};

export default pool;
