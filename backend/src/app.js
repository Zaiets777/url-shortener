import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/database.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { linksRouter } from './routes/links.js';
import { Link } from './models/Link.js';

export function createApp({ dbCheck = checkDatabaseConnection } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendUrl.split(',').map((url) => url.trim()), credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'url-shortener-api' });
  });

  app.get('/api/v1/health/db', async (_req, res, next) => {
    try {
      await dbCheck();
      res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error) {
      // Do not reveal DB credentials or connection details in HTTP responses.
      console.error('Database health check failed:', error.message);
      res.status(503).json({ message: 'Database unavailable' });
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/links', linksRouter);

  // Public short URL redirect: never cache so each visit increments the counter.
  app.get('/:shortCode', async (req, res, next) => {
    try {
      if (!/^[A-Za-z0-9_-]{6,8}$/.test(req.params.shortCode)) return next();
      const destination = await Link.resolveAndCount(req.params.shortCode);
      if (!destination) return res.status(404).json({ message: 'Short link not found or expired' });
      res.set('Cache-Control', 'no-store');
      res.redirect(302, destination);
    } catch (error) { next(error); }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
