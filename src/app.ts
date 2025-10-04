import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import interventionRoutes from './routes/interventionRoutes';
import swarmRoutes from './routes/swarmRoutes';
import velocityRoutes from './routes/velocityRoutes';
import deploymentRoutes from './routes/deploymentRoutes';
import hostRoutes from './routes/hostRoutes';
import authRoutes from './routes/authRoutes';
import notificationRoutes from './routes/notificationRoutes';
import batchOperationsRoutes from './routes/batchOperationsRoutes';
import { swarmPollingService } from './services/swarmPollingService';
import { generalLimiter } from './middleware/rateLimiter';
import { authenticateApiKey } from './middleware/auth';
import { firebaseAuthService } from './services/firebaseAuthService';

dotenv.config();

const app: Application = express();

// Initialize Firebase Auth (if configured)
try {
  firebaseAuthService.initialize();
} catch (error) {
  console.warn('Firebase Auth not initialized:', error);
}

// Start swarm polling service
swarmPollingService.start();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint (before rate limiting and auth)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'QiFlow Control Center API',
  });
});

// Apply rate limiting to all API routes
app.use('/api', generalLimiter);

// Auth routes (public, no API key required)
app.use('/api/v1/auth', authRoutes);

// Apply authentication to protected API routes
app.use('/api', authenticateApiKey);

// Protected API routes
app.use('/api/v1/interventions', interventionRoutes);
app.use('/api/v1/swarms', swarmRoutes);
app.use('/api/v1/velocity', velocityRoutes);
app.use('/api/v1/deployments', deploymentRoutes);
app.use('/api/v1/hosts', hostRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', batchOperationsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default app;
