import { Request, Response, NextFunction } from 'express';

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
