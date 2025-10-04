import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

/**
 * User interface
 */
export interface User {
  id: string;
  firebase_uid: string;
  email: string;
  display_name?: string;
  photo_url?: string;
  email_verified: boolean;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  firebase_uid: string;
  email: string;
  display_name?: string;
  photo_url?: string;
  email_verified?: boolean;
  is_admin?: boolean;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  display_name?: string;
  photo_url?: string;
  email_verified?: boolean;
  is_admin?: boolean;
  last_login_at?: Date;
}

/**
 * User Model
 * Handles database operations for users
 */
export class UserModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize database schema
   * Creates users table if it doesn't exist
   */
  async initializeSchema(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firebase_uid VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        photo_url VARCHAR(500),
        email_verified BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `;

    await this.pool.query(query);
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const id = uuidv4();
    const query = `
      INSERT INTO users (
        id, firebase_uid, email, display_name, photo_url,
        email_verified, is_admin, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      id,
      input.firebase_uid,
      input.email,
      input.display_name || null,
      input.photo_url || null,
      input.email_verified || false,
      input.is_admin || false,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0] as User;
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(firebase_uid: string): Promise<User | null> {
    const query = `
      SELECT * FROM users WHERE firebase_uid = $1
    `;

    const result = await this.pool.query(query, [firebase_uid]);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const query = `
      SELECT * FROM users WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT * FROM users WHERE email = $1
    `;

    const result = await this.pool.query(query, [email]);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Update user
   */
  async updateUser(firebase_uid: string, input: UpdateUserInput): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(input.display_name);
    }

    if (input.photo_url !== undefined) {
      fields.push(`photo_url = $${paramIndex++}`);
      values.push(input.photo_url);
    }

    if (input.email_verified !== undefined) {
      fields.push(`email_verified = $${paramIndex++}`);
      values.push(input.email_verified);
    }

    if (input.is_admin !== undefined) {
      fields.push(`is_admin = $${paramIndex++}`);
      values.push(input.is_admin);
    }

    if (input.last_login_at !== undefined) {
      fields.push(`last_login_at = $${paramIndex++}`);
      values.push(input.last_login_at);
    }

    if (fields.length === 0) {
      return this.getUserByFirebaseUid(firebase_uid);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(firebase_uid);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE firebase_uid = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Update last login time
   */
  async updateLastLogin(firebase_uid: string): Promise<void> {
    const query = `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE firebase_uid = $1
    `;

    await this.pool.query(query, [firebase_uid]);
  }

  /**
   * Delete user
   */
  async deleteUser(firebase_uid: string): Promise<boolean> {
    const query = `
      DELETE FROM users WHERE firebase_uid = $1
    `;

    const result = await this.pool.query(query, [firebase_uid]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get or create user (upsert)
   * Used when user logs in via Firebase
   */
  async getOrCreateUser(input: CreateUserInput): Promise<User> {
    const existingUser = await this.getUserByFirebaseUid(input.firebase_uid);

    if (existingUser) {
      // Update last login and return existing user
      await this.updateLastLogin(input.firebase_uid);
      return existingUser;
    }

    // Create new user
    return this.createUser(input);
  }

  /**
   * List all users (admin only)
   */
  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    const query = `
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows as User[];
  }

  /**
   * Count total users
   */
  async countUsers(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM users
    `;

    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count, 10);
  }
}
