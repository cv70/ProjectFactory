import type { Express } from 'express';
import { ideasRouter } from './routes/ideas.js';
import { projectsRouter } from './routes/projects.js';
import { statusRouter } from './routes/status.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('API');

/**
 * Setup all API routes
 */
export function setupApiRoutes(app: Express): void {
  // Mount route handlers
  app.use('/api/ideas', ideasRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/status', statusRouter);

  // API info endpoint
  app.get('/api', (req, res) => {
    res.json({
      name: 'ProjectFactory API',
      version: '1.0.0',
      endpoints: {
        ideas: '/api/ideas',
        projects: '/api/projects',
        status: '/api/status',
      },
    });
  });

  logger.info('API routes configured');
}
