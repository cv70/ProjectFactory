import { createLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { orchestrator } from './simple-orchestrator.js';

const logger = createLogger('Scheduler');

/**
 * Scheduler for periodic idea generation and project development
 */
export class Scheduler {
  private ideaIntervalId: NodeJS.Timeout | null = null;
  private projectIntervalId: NodeJS.Timeout | null = null;
  private running = false;

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.running = true;
    logger.info('Scheduler started');

    // Start idea generation if enabled
    if (config.pipeline.ideaGeneration.enabled) {
      this.startIdeaGeneration();
    }

    // Start project development if enabled
    if (config.pipeline.projectDevelopment.enabled) {
      this.startProjectDevelopment();
    }
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.ideaIntervalId) {
      clearInterval(this.ideaIntervalId);
      this.ideaIntervalId = null;
    }

    if (this.projectIntervalId) {
      clearInterval(this.projectIntervalId);
      this.projectIntervalId = null;
    }

    logger.info('Scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Start periodic idea generation
   */
  private startIdeaGeneration(): void {
    const interval = config.pipeline.ideaGeneration.interval;

    logger.info('Starting idea generation scheduler', { intervalMs: interval });

    // Run immediately on start
    this.runIdeaGenerationCycle();

    // Then run periodically
    this.ideaIntervalId = setInterval(() => {
      this.runIdeaGenerationCycle();
    }, interval);
  }

  /**
   * Start periodic project development
   */
  private startProjectDevelopment(): void {
    const interval = 30000; // Check every 30 seconds for new projects

    logger.info('Starting project development scheduler', { intervalMs: interval });

    // Run immediately on start
    this.runProjectDevelopmentCycle();

    // Then run periodically
    this.projectIntervalId = setInterval(() => {
      this.runProjectDevelopmentCycle();
    }, interval);
  }

  /**
   * Run one idea generation cycle
   */
  private async runIdeaGenerationCycle(): Promise<void> {
    try {
      logger.debug('Running idea generation cycle');
      await orchestrator.runIdeaGeneration();
    } catch (error) {
      logger.error('Idea generation cycle failed', error);
    }
  }

  /**
   * Run one project development cycle
   */
  private async runProjectDevelopmentCycle(): Promise<void> {
    try {
      logger.debug('Running project development cycle');
      const result = await orchestrator.pickAndDevelopIdea();

      if (result.success) {
        logger.info('Project development cycle completed', { projectId: result.projectId });
      } else if (result.error !== 'No queued ideas') {
        logger.warn('Project development cycle failed', { error: result.error });
      }
    } catch (error) {
      logger.error('Project development cycle failed', error);
    }
  }

  /**
   * Trigger an immediate idea generation
   */
  async triggerIdeaGeneration(): Promise<void> {
    logger.info('Triggering immediate idea generation');
    await this.runIdeaGenerationCycle();
  }

  /**
   * Trigger an immediate project development
   */
  async triggerProjectDevelopment(): Promise<void> {
    logger.info('Triggering immediate project development');
    await this.runProjectDevelopmentCycle();
  }
}

// Export singleton instance
export const scheduler = new Scheduler();
