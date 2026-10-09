import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd, isTest } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';
import { apiLimiter } from './common/middleware/rateLimit';
import { prisma } from './lib/prisma';
import { apiV1 } from './routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY); // correct client IPs behind Render/Railway/Next.js proxy
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan(isProd ? 'combined' : 'dev'));

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down', time: new Date().toISOString() });
    }
  });

  app.use('/api/v1', apiLimiter, apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
