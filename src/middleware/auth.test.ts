import { Request, Response, NextFunction } from 'express';
import { authenticateApiKey, optionalAuth } from './auth';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    } as Partial<Request>;
    Object.defineProperty(mockRequest, 'path', {
      value: '/api/v1/test',
      writable: true,
      configurable: true,
    });
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    process.env.API_KEY_SECRET = 'test-api-key-123';
  });

  describe('authenticateApiKey', () => {
    it('should allow health check endpoint without authentication', () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/health',
        writable: true,
        configurable: true,
      });
      
      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing authorization header',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <token>"',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept valid Bearer token', () => {
      mockRequest.headers = { authorization: 'Bearer test-api-key-123' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should accept valid ApiKey token', () => {
      mockRequest.headers = { authorization: 'ApiKey test-api-key-123' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject invalid API key', () => {
      mockRequest.headers = { authorization: 'Bearer wrong-key' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle missing API_KEY_SECRET configuration', () => {
      delete process.env.API_KEY_SECRET;
      mockRequest.headers = { authorization: 'Bearer test-api-key-123' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server configuration error',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject authorization with invalid prefix (not Bearer or ApiKey)', () => {
      mockRequest.headers = { authorization: 'Basic test-api-key-123' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <token>"',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject authorization with only one part', () => {
      mockRequest.headers = { authorization: 'BearerTokenWithoutSpace' };

      authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <token>"',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should continue without authentication if no header provided', () => {
      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBeUndefined();
    });

    it('should mark request as authenticated with valid API key', () => {
      mockRequest.headers = { authorization: 'Bearer test-api-key-123' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBe(true);
    });

    it('should continue without marking as authenticated for invalid API key', () => {
      mockRequest.headers = { authorization: 'Bearer wrong-key' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBeUndefined();
    });

    it('should handle invalid authorization format gracefully', () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBeUndefined();
    });

    it('should mark as authenticated with ApiKey format', () => {
      mockRequest.headers = { authorization: 'ApiKey test-api-key-123' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBe(true);
    });

    it('should continue without marking authenticated if API_KEY_SECRET not configured', () => {
      delete process.env.API_KEY_SECRET;
      mockRequest.headers = { authorization: 'Bearer test-api-key-123' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBeUndefined();
    });

    it('should handle authorization header with wrong prefix', () => {
      mockRequest.headers = { authorization: 'Basic test-api-key-123' };

      optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).authenticated).toBeUndefined();
    });
  });
});
