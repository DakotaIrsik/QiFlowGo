import { Pool } from 'pg';
import { UserModel, CreateUserInput, UpdateUserInput } from './UserModel';

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn(),
  })),
}));

describe('UserModel', () => {
  let userModel: UserModel;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    userModel = new UserModel(mockPool);
    jest.clearAllMocks();
  });

  describe('initializeSchema', () => {
    it('should create users table and indexes', async () => {
      mockPool.query.mockResolvedValue({} as any);

      await userModel.initializeSchema();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS users'));
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const input: CreateUserInput = {
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockUser = {
        id: 'user-id-123',
        ...input,
        email_verified: false,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await userModel.createUser(input);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          expect.any(String), // id
          input.firebase_uid,
          input.email,
          input.display_name,
          null, // photo_url
          false, // email_verified
          false, // is_admin
        ])
      );
      expect(result).toEqual(mockUser);
    });

    it('should create user with admin flag', async () => {
      const input: CreateUserInput = {
        firebase_uid: 'firebase-admin-123',
        email: 'admin@example.com',
        is_admin: true,
      };

      const mockUser = {
        id: 'user-id-456',
        ...input,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      await userModel.createUser(input);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          expect.any(String),
          input.firebase_uid,
          input.email,
          null, // display_name
          null, // photo_url
          false, // email_verified
          true, // is_admin
        ])
      );
    });
  });

  describe('getUserByFirebaseUid', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-id-123',
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
        email_verified: true,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await userModel.getUserByFirebaseUid('firebase-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE firebase_uid'),
        ['firebase-123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await userModel.getUserByFirebaseUid('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-id-123',
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
        email_verified: true,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await userModel.getUserById('user-id-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id'),
        ['user-id-123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await userModel.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const update: UpdateUserInput = {
        display_name: 'Updated Name',
        email_verified: true,
      };

      const mockUser = {
        id: 'user-id-123',
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
        display_name: 'Updated Name',
        email_verified: true,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await userModel.updateUser('firebase-123', update);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['Updated Name', true, 'firebase-123'])
      );
      expect(result).toEqual(mockUser);
    });

    it('should return existing user if no updates provided', async () => {
      const mockUser = {
        id: 'user-id-123',
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
        email_verified: true,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await userModel.updateUser('firebase-123', {});

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE firebase_uid'),
        ['firebase-123']
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockPool.query.mockResolvedValue({} as any);

      await userModel.updateLastLogin('firebase-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['firebase-123']
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 } as any);

      const result = await userModel.deleteUser('firebase-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE firebase_uid'),
        ['firebase-123']
      );
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 } as any);

      const result = await userModel.deleteUser('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getOrCreateUser', () => {
    it('should return existing user and update last login', async () => {
      const input: CreateUserInput = {
        firebase_uid: 'firebase-123',
        email: 'test@example.com',
      };

      const mockUser = {
        id: 'user-id-123',
        ...input,
        email_verified: false,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // First call returns existing user, second call for updateLastLogin
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any)
        .mockResolvedValueOnce({} as any);

      const result = await userModel.getOrCreateUser(input);

      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledTimes(2); // getUserByFirebaseUid + updateLastLogin
    });

    it('should create new user when not exists', async () => {
      const input: CreateUserInput = {
        firebase_uid: 'firebase-new',
        email: 'new@example.com',
      };

      const mockUser = {
        id: 'user-id-new',
        ...input,
        email_verified: false,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // First call returns no user, second call creates new user
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [mockUser] } as any);

      const result = await userModel.getOrCreateUser(input);

      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledTimes(2); // getUserByFirebaseUid + createUser
    });
  });

  describe('listUsers', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [
        { id: 'user-1', firebase_uid: 'fb-1', email: 'user1@test.com' },
        { id: 'user-2', firebase_uid: 'fb-2', email: 'user2@test.com' },
      ];

      mockPool.query.mockResolvedValue({ rows: mockUsers } as any);

      const result = await userModel.listUsers(10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        [10, 0]
      );
      expect(result).toEqual(mockUsers);
    });
  });

  describe('countUsers', () => {
    it('should return total user count', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }] } as any);

      const result = await userModel.countUsers();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)')
      );
      expect(result).toBe(42);
    });
  });
});
