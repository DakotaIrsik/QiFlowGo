import admin from 'firebase-admin';

/**
 * Firebase Authentication Service
 * Handles Firebase Admin SDK initialization and token validation
 */
class FirebaseAuthService {
  private initialized = false;

  /**
   * Initialize Firebase Admin SDK
   * Uses service account credentials from environment variables
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Check if Firebase credentials are provided
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      if (!serviceAccountKey) {
        console.warn('Firebase Admin SDK not initialized: FIREBASE_SERVICE_ACCOUNT_KEY not found');
        return;
      }

      // Parse service account JSON
      const serviceAccount = JSON.parse(serviceAccountKey);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  /**
   * Verify Firebase ID token
   * @param token - Firebase ID token from client
   * @returns Decoded token with user information
   */
  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by UID
   * @param uid - Firebase user UID
   * @returns User record
   */
  async getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    try {
      const userRecord = await admin.auth().getUser(uid);
      return userRecord;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw new Error('User not found');
    }
  }

  /**
   * Create custom token for user
   * @param uid - Firebase user UID
   * @param additionalClaims - Optional additional claims
   * @returns Custom token
   */
  async createCustomToken(
    uid: string,
    additionalClaims?: object
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    try {
      const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
      return customToken;
    } catch (error) {
      console.error('Failed to create custom token:', error);
      throw new Error('Token creation failed');
    }
  }

  /**
   * Revoke refresh tokens for user (logout)
   * @param uid - Firebase user UID
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    try {
      await admin.auth().revokeRefreshTokens(uid);
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
      throw new Error('Token revocation failed');
    }
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const firebaseAuthService = new FirebaseAuthService();
