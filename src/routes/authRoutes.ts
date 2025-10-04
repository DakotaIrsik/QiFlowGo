import { Router, Request, Response } from 'express';
import { firebaseAuthService } from '../services/firebaseAuthService';
import { body, validationResult } from 'express-validator';

const router = Router();

/**
 * POST /api/v1/auth/verify
 * Verify Firebase ID token and return user information
 *
 * Request body:
 * {
 *   "idToken": "firebase-id-token"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "uid": "user-id",
 *     "email": "user@example.com",
 *     "emailVerified": true
 *   }
 * }
 */
router.post(
  '/verify',
  [
    body('idToken').isString().notEmpty().withMessage('idToken is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const { idToken } = req.body;

    try {
      // Verify token with Firebase
      const decodedToken = await firebaseAuthService.verifyToken(idToken);

      // Return user information
      res.status(200).json({
        success: true,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified,
          name: decodedToken.name,
          picture: decodedToken.picture,
        },
      });
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  }
);

/**
 * GET /api/v1/auth/user/:uid
 * Get user information by UID
 * Requires valid Firebase token in Authorization header
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "uid": "user-id",
 *     "email": "user@example.com",
 *     "emailVerified": true,
 *     "disabled": false
 *   }
 * }
 */
router.get('/user/:uid', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params;

  try {
    // Get authorization token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decodedToken = await firebaseAuthService.verifyToken(token);

    // Check if requesting own data or if user is admin
    if (decodedToken.uid !== uid && !decodedToken.admin) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other user data',
      });
      return;
    }

    // Get user information
    const userRecord = await firebaseAuthService.getUserByUid(uid);

    res.status(200).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user information',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Revoke all refresh tokens for user (force logout on all devices)
 *
 * Request body:
 * {
 *   "uid": "user-id"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "User logged out successfully"
 * }
 */
router.post(
  '/logout',
  [
    body('uid').isString().notEmpty().withMessage('uid is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const { uid } = req.body;

    try {
      // Get authorization token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header',
        });
        return;
      }

      const token = authHeader.substring(7);

      // Verify token
      const decodedToken = await firebaseAuthService.verifyToken(token);

      // Check if logging out self or if user is admin
      if (decodedToken.uid !== uid && !decodedToken.admin) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Cannot logout other users',
        });
        return;
      }

      // Revoke refresh tokens
      await firebaseAuthService.revokeRefreshTokens(uid);

      res.status(200).json({
        success: true,
        message: 'User logged out successfully',
      });
    } catch (error) {
      console.error('Logout failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to logout user',
      });
    }
  }
);

/**
 * POST /api/v1/auth/custom-token
 * Create custom token for user (admin only)
 *
 * Request body:
 * {
 *   "uid": "user-id",
 *   "claims": { "admin": true }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "customToken": "custom-token-string"
 * }
 */
router.post(
  '/custom-token',
  [
    body('uid').isString().notEmpty().withMessage('uid is required'),
    body('claims').optional().isObject().withMessage('claims must be an object'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    const { uid, claims } = req.body;

    try {
      // Get authorization token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header',
        });
        return;
      }

      const token = authHeader.substring(7);

      // Verify token
      const decodedToken = await firebaseAuthService.verifyToken(token);

      // Only admins can create custom tokens
      if (!decodedToken.admin) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Admin access required',
        });
        return;
      }

      // Create custom token
      const customToken = await firebaseAuthService.createCustomToken(uid, claims);

      res.status(200).json({
        success: true,
        customToken,
      });
    } catch (error) {
      console.error('Failed to create custom token:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create custom token',
      });
    }
  }
);

/**
 * GET /api/v1/auth/status
 * Check if Firebase authentication is available
 *
 * Response:
 * {
 *   "success": true,
 *   "firebaseEnabled": true
 * }
 */
router.get('/status', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    firebaseEnabled: firebaseAuthService.isInitialized(),
  });
});

export default router;
