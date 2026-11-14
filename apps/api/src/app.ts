import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { authRouter } from './routes/auth.routes.js';
import { analyticsRouter, healthRouter, paymentsRouter } from './routes/misc.routes.js';
import { transactionRouter } from './routes/transaction.routes.js';
import { voiceRouter } from './routes/voice.routes.js';

export function createApp() {
  const e = env();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  const allowed = e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      exposedHeaders: ['Content-Disposition', 'X-TTS-Voice'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '50kb' }));
  app.use(globalLimiter);

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/analytics', analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
