import { Router } from 'express';
import { ideaRepository } from '../../domain/idea/persistence.js';
import type { CreateIdeaInput } from '../../domain/idea/schema.js';
import { createLogger } from '../../utils/logger.js';
import { generateIdeasFromTopic } from '../../agents/idea-generator/idea-generator.js';
import { orchestrator } from '../../orchestration/simple-orchestrator.js';

const logger = createLogger('IdeasAPI');
const router = Router();

/**
 * GET /api/ideas - Get all ideas
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const ideas = await ideaRepository.findAll({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ ideas });
  } catch (error) {
    logger.error('Failed to fetch ideas', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

/**
 * GET /api/ideas/queued - Get queued ideas
 */
router.get('/queued', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const ideas = await ideaRepository.findQueued(limit);
    res.json({ ideas });
  } catch (error) {
    logger.error('Failed to fetch queued ideas', error);
    res.status(500).json({ error: 'Failed to fetch queued ideas' });
  }
});

/**
 * GET /api/ideas/pending - Get pending ideas
 */
router.get('/pending', async (req, res) => {
  try {
    const ideas = await ideaRepository.findPending();
    res.json({ ideas });
  } catch (error) {
    logger.error('Failed to fetch pending ideas', error);
    res.status(500).json({ error: 'Failed to fetch pending ideas' });
  }
});

/**
 * GET /api/ideas/stats - Get idea statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await ideaRepository.getStats();
    const count = await ideaRepository.countByStatus();
    res.json({ stats, total: count });
  } catch (error) {
    logger.error('Failed to fetch idea stats', error);
    res.status(500).json({ error: 'Failed to fetch idea stats' });
  }
});

/**
 * GET /api/ideas/:id - Get idea by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const idea = await ideaRepository.findById(req.params.id);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.json({ idea });
  } catch (error) {
    logger.error('Failed to fetch idea', error);
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

/**
 * POST /api/ideas - Create a new idea
 */
router.post('/', async (req, res) => {
  try {
    const input: CreateIdeaInput = req.body;
    const idea = await ideaRepository.create(input);
    res.status(201).json({ idea });
  } catch (error) {
    logger.error('Failed to create idea', error);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

/**
 * POST /api/ideas/:id/queue - Add idea to queue
 */
router.post('/:id/queue', async (req, res) => {
  try {
    const idea = await ideaRepository.addToQueue(req.params.id);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.json({ idea });
  } catch (error) {
    logger.error('Failed to queue idea', error);
    res.status(500).json({ error: 'Failed to queue idea' });
  }
});

/**
 * POST /api/ideas/generate - Generate ideas from a theme/topic
 */
router.post('/generate', async (req, res) => {
  try {
    const { topic, count = 3 } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    logger.info('Generating ideas from topic', { topic, count });
    const ideas = await generateIdeasFromTopic(topic.trim(), count);

    res.status(201).json({ ideas, count: ideas.length });
  } catch (error) {
    logger.error('Failed to generate ideas', error);
    res.status(500).json({ error: 'Failed to generate ideas' });
  }
});

/**
 * POST /api/ideas/:id/develop - Manually start project development from an idea
 */
router.post('/:id/develop', async (req, res) => {
  try {
    const idea = await ideaRepository.findById(req.params.id);

    if (!idea) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }

    if (idea.status !== 'pending' && idea.status !== 'queued') {
      res.status(400).json({ error: `Cannot develop idea with status: ${idea.status}` });
      return;
    }

    logger.info('Manually starting project development', { ideaId: idea.id, title: idea.title });

    // Run development synchronously for manual trigger
    const result = await orchestrator.pickAndDevelopIdeaForIdea(idea.id);

    if (result.success) {
      res.json({ success: true, projectId: result.projectId, message: 'Project development started' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Failed to start project development', error);
    res.status(500).json({ error: 'Failed to start project development' });
  }
});

/**
 * DELETE /api/ideas/:id - Delete an idea
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ideaRepository.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Idea not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete idea', error);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

export { router as ideasRouter };
