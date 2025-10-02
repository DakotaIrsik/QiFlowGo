import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import interventionRoutes from './routes/interventionRoutes';
import swarmRoutes from './routes/swarmRoutes';
import velocityRoutes from './routes/velocityRoutes';
import deploymentRoutes from './routes/deploymentRoutes';
import hostRoutes from './routes/hostRoutes';
import { swarmPollingService } from './services/swarmPollingService';

dotenv.config();

const app: Application = express();

// Start swarm polling service
swarmPollingService.start();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'QiFlow Control Center API',
  });
});

// API routes
app.use('/api/v1', interventionRoutes);
app.use('/api/v1', swarmRoutes);
app.use('/api/v1', velocityRoutes);
app.use('/api/v1', deploymentRoutes);
app.use('/api/v1', hostRoutes);

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
