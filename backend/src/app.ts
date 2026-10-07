import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import apiRoutes from './routes';
import { env, isDev } from './config/env';
import { prisma } from './config/db';
import { ensureUploadsDir } from './middleware/upload';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const corsOrigin = env.CORS_ORIGIN.trim();
  app.use(
    cors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
      credentials: true
    })
  );

  app.use(compression());
  app.use(morgan(isDev ? 'dev' : 'combined'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', async (_req, res) => {
    let database = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'disconnected';
    }
    res.status(200).json({
      success: true,
      message: 'Fuel Management API is healthy.',
      data: {
        status: 'ok',
        database,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  });

  app.use(
    '/uploads',
    express.static(ensureUploadsDir(), { dotfiles: 'ignore', index: false, maxAge: '1d' })
  );

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}