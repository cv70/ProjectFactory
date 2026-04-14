import { Router } from 'express';
import { projectRepository } from '../../domain/project/persistence.js';
import type { CreateProjectInput } from '../../domain/project/schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ProjectsAPI');
const router = Router();

/**
 * GET /api/projects - Get all projects
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const projects = await projectRepository.findAll({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ projects });
  } catch (error) {
    logger.error('Failed to fetch projects', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/active - Get active projects
 */
router.get('/active', async (req, res) => {
  try {
    const projects = await projectRepository.findActive();
    res.json({ projects });
  } catch (error) {
    logger.error('Failed to fetch active projects', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

/**
 * GET /api/projects/stats - Get project statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await projectRepository.getStats();
    res.json({ stats });
  } catch (error) {
    logger.error('Failed to fetch project stats', error);
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
});

/**
 * GET /api/projects/:id - Get project by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const project = await projectRepository.findById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    logger.error('Failed to fetch project', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * POST /api/projects - Create a new project
 */
router.post('/', async (req, res) => {
  try {
    const input: CreateProjectInput = req.body;
    const project = await projectRepository.create(input);
    res.status(201).json({ project });
  } catch (error) {
    logger.error('Failed to create project', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PATCH /api/projects/:id - Update project
 */
router.patch('/:id', async (req, res) => {
  try {
    const project = await projectRepository.update(req.params.id, req.body);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    logger.error('Failed to update project', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * POST /api/projects/:id/complete - Mark project as completed
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const project = await projectRepository.markCompleted(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    logger.error('Failed to complete project', error);
    res.status(500).json({ error: 'Failed to complete project' });
  }
});

/**
 * POST /api/projects/:id/fail - Mark project as failed
 */
router.post('/:id/fail', async (req, res) => {
  try {
    const { error } = req.body;
    const project = await projectRepository.markFailed(req.params.id, error);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    logger.error('Failed to mark project as failed', error);
    res.status(500).json({ error: 'Failed to mark project as failed' });
  }
});

export { router as projectsRouter };
