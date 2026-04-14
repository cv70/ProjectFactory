import { Router } from 'express';
import { ideaRepository } from '../../domain/idea/persistence.js';
import { projectRepository } from '../../domain/project/persistence.js';
import { createLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

const logger = createLogger('StatusAPI');
const router = Router();

const startTime = Date.now();

/**
 * GET /api/status - Get system status
 */
router.get('/', async (req, res) => {
  try {
    const [
      ideaStats,
      projectStats,
      queuedIdeas,
      activeProjects,
    ] = await Promise.all([
      ideaRepository.getStats(),
      projectRepository.getStats(),
      ideaRepository.findQueued(10),
      projectRepository.findActive(),
    ]);

    res.json({
      status: 'running',
      uptime: Date.now() - startTime,
      timestamp: Date.now(),
      config: {
        llm: {
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
        pipeline: {
          ideaGeneration: config.pipeline.ideaGeneration.enabled,
          projectDevelopment: config.pipeline.projectDevelopment.enabled,
          iteration: config.pipeline.iteration.enabled,
        },
      },
      ideas: {
        ...ideaStats,
        queuedCount: queuedIdeas.length,
      },
      projects: {
        ...projectStats,
        activeCount: activeProjects.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch system status', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

/**
 * GET /api/status/health - Detailed health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await ideaRepository.findAll({ limit: 1 });

    res.json({
      healthy: true,
      checks: {
        database: 'ok',
        llm: 'unknown', // Would need actual LLM ping
      },
    });
  } catch (error) {
    res.status(503).json({
      healthy: false,
      error: (error as Error).message,
    });
  }
});

export { router as statusRouter };
