import { firebaseAuthService } from './firebaseAuthService';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn(),
    },
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
      getUser: jest.fn(),
      createCustomToken: jest.fn(),
      revokeRefreshTokens: jest.fn(),
    })),
  },
}));

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service to uninitialized state
    (firebaseAuthService as any).initialized = false;
  });

  describe('initialize', () => {
    it('should not initialize if FIREBASE_SERVICE_ACCOUNT_KEY is not set', () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      firebaseAuthService.initialize();

      expect(firebaseAuthService.isInitialized()).toBe(false);
    });

    it('should not reinitialize if already initialized', () => {
      const serviceAccount = {
        projectId: 'test-project',
        clientEmail: 'test@test.iam.gserviceaccount.com',
        privateKey: 'test-private-key',
      };
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount);

      // Initialize twice
      firebaseAuthService.initialize();
      const firstInitStatus = firebaseAuthService.isInitialized();
      firebaseAuthService.initialize();
      const secondInitStatus = firebaseAuthService.isInitialized();

      expect(firstInitStatus).toBe(true);
      expect(secondInitStatus).toBe(true);
    });
  });

  describe('isInitialized', () => {
    it('should return false when not initialized', () => {
      expect(firebaseAuthService.isInitialized()).toBe(false);
    });

    it('should return true when initialized', () => {
      const serviceAccount = {
        projectId: 'test-project',
        clientEmail: 'test@test.iam.gserviceaccount.com',
        privateKey: 'test-private-key',
      };
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount);

      firebaseAuthService.initialize();

      expect(firebaseAuthService.isInitialized()).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should throw error if not initialized', async () => {
      await expect(firebaseAuthService.verifyToken('test-token')).rejects.toThrow(
        'Firebase Admin SDK not initialized'
      );
    });
  });

  describe('getUserByUid', () => {
    it('should throw error if not initialized', async () => {
      await expect(firebaseAuthService.getUserByUid('test-uid')).rejects.toThrow(
        'Firebase Admin SDK not initialized'
      );
    });
  });

  describe('createCustomToken', () => {
    it('should throw error if not initialized', async () => {
      await expect(firebaseAuthService.createCustomToken('test-uid')).rejects.toThrow(
        'Firebase Admin SDK not initialized'
      );
    });
  });

  describe('revokeRefreshTokens', () => {
    it('should throw error if not initialized', async () => {
      await expect(firebaseAuthService.revokeRefreshTokens('test-uid')).rejects.toThrow(
        'Firebase Admin SDK not initialized'
      );
    });
  });
});
