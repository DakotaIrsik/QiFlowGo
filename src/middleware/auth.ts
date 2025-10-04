import { Request, Response, NextFunction } from 'express';
import { firebaseAuthService } from '../services/firebaseAuthService';

/**
 * Extended Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    admin?: boolean;
  };
  authenticated?: boolean;
}

/**
 * Authentication middleware using API key
 * Validates API key from Authorization header
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  // Allow health check endpoint without authentication
  if (req.path === '/health') {
    next();
    return;
  }

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Missing authorization header',
    });
    return;
  }

  // Support both "Bearer <token>" and "ApiKey <token>" formats
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || !['Bearer', 'ApiKey'].includes(parts[0])) {
    res.status(401).json({
      success: false,
      error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <token>"',
    });
    return;
  }

  const apiKey = parts[1];
  const validApiKey = process.env.API_KEY_SECRET;

  if (!validApiKey) {
    console.error('API_KEY_SECRET is not configured in environment variables');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
    return;
  }

  if (apiKey !== validApiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  // API key is valid, proceed to next middleware
  next();
};

/**
 * Authentication middleware using Firebase ID token
 * Validates Firebase token from Authorization header (Bearer token)
 */
export const authenticateFirebase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Allow health check endpoint without authentication
  if (req.path === '/health') {
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header. Use "Bearer <firebase-token>"',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify Firebase token
    const decodedToken = await firebaseAuthService.verifyToken(token);

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      admin: decodedToken.admin || false,
    };
    (req as AuthenticatedRequest).authenticated = true;

    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired Firebase token',
    });
  }
};

/**
 * Hybrid authentication middleware
 * Accepts either API key or Firebase token
 */
export const authenticateHybrid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Allow health check endpoint without authentication
  if (req.path === '/health') {
    next();
    return;
  }

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Missing authorization header',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    res.status(401).json({
      success: false,
      error: 'Invalid authorization format',
    });
    return;
  }

  const [authType, token] = parts;

  try {
    if (authType === 'ApiKey') {
      // Validate API key
      const validApiKey = process.env.API_KEY_SECRET;
      if (!validApiKey) {
        res.status(500).json({
          success: false,
          error: 'Server configuration error',
        });
        return;
      }

      if (token !== validApiKey) {
        res.status(403).json({
          success: false,
          error: 'Invalid API key',
        });
        return;
      }

      (req as AuthenticatedRequest).authenticated = true;
      next();
    } else if (authType === 'Bearer') {
      // Validate Firebase token
      const decodedToken = await firebaseAuthService.verifyToken(token);

      (req as AuthenticatedRequest).user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        admin: decodedToken.admin || false,
      };
      (req as AuthenticatedRequest).authenticated = true;

      next();
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization type. Use "Bearer <token>" or "ApiKey <token>"',
      });
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Validates API key if provided, but allows unauthenticated requests
 * Useful for endpoints that have different behavior based on authentication
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No authentication provided, continue without user context
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && ['Bearer', 'ApiKey'].includes(parts[0])) {
    const apiKey = parts[1];
    const validApiKey = process.env.API_KEY_SECRET;

    if (apiKey === validApiKey) {
      // Valid API key, mark request as authenticated
      (req as any).authenticated = true;
    }
  }

  next();
};
