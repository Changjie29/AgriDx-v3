import express from 'express';
import cors from 'cors';
import { apiNotFound, createChatRateLimiter, errorHandler, securityHeaders } from './http/middleware';
import { createCatalogRoutes } from './routes/catalog';
import { createChatRoutes } from './routes/chat';
import { createStatusRoutes } from './routes/status';
import type { ServerRuntime } from './runtime';

/** Assemble HTTP only; callers control initialization and listening. */
export function createApp(runtime: ServerRuntime): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/chat', createChatRateLimiter());
  app.use('/api', createStatusRoutes(runtime), createCatalogRoutes(runtime.getCatalog), createChatRoutes(runtime.diagnose));
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
