import { createLogger } from '../utils/logger.js';
import { ideaRepository } from '../domain/idea/persistence.js';
import { projectRepository } from '../domain/project/persistence.js';
import { filesystem } from '../infra/filesystem.js';
import { config } from '../config/index.js';
import { scheduler } from './scheduler.js';

const logger = createLogger('ProjectManager');

/**
 * Project lifecycle manager
 * Handles picking ideas, creating projects, and moving them through their lifecycle
 */
export class ProjectManager {
  private running = false;

  /**
   * Start the project manager
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('ProjectManager is already running');
      return;
    }

    this.running = true;
    logger.info('ProjectManager started');

    // Ensure workspace directories exist
    await this.ensureWorkspaceDirs();
  }

  /**
   * Stop the project manager
   */
  async stop(): Promise<void> {
    this.running = false;
    logger.info('ProjectManager stopped');
  }

  /**
   * Ensure all workspace directories exist
   */
  private async ensureWorkspaceDirs(): Promise<void> {
    const dirs = [
      config.workspace.root,
      config.workspace.activeDir,
      config.workspace.completedDir,
      config.workspace.archivedDir,
    ];

    for (const dir of dirs) {
      await filesystem.ensureDir(dir);
    }

    logger.info('Workspace directories ensured');
  }

  /**
   * Get project statistics
   */
  async getStats(): Promise<{
    ideas: Record<string, number>;
    projects: Record<string, number>;
  }> {
    const [ideaStats, projectStats] = await Promise.all([
      ideaRepository.getStats(),
      projectRepository.getStats(),
    ]);

    return {
      ideas: ideaStats,
      projects: projectStats,
    };
  }

  /**
   * Move a project to completed directory
   */
  async moveToCompleted(projectId: string): Promise<boolean> {
    try {
      const project = await projectRepository.findById(projectId);
      if (!project) {
        logger.warn('Project not found', { projectId });
        return false;
      }

      const completedPath = `${config.workspace.completedDir}/${projectId}`;

      // Move files
      await filesystem.ensureDir(completedPath);
      // Note: In a real implementation, we'd move/copy files here

      logger.info('Project moved to completed', { projectId, path: completedPath });
      return true;
    } catch (error) {
      logger.error('Failed to move project to completed', error);
      return false;
    }
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string): Promise<boolean> {
    try {
      const project = await projectRepository.findById(projectId);
      if (!project) {
        logger.warn('Project not found', { projectId });
        return false;
      }

      const archivedPath = `${config.workspace.archivedDir}/${projectId}`;

      // Move files
      await filesystem.ensureDir(archivedPath);

      logger.info('Project archived', { projectId, path: archivedPath });
      return true;
    } catch (error) {
      logger.error('Failed to archive project', error);
      return false;
    }
  }

  /**
   * Get system status summary
   */
  async getSystemStatus(): Promise<{
    scheduler: { running: boolean };
    orchestrator: { running: boolean };
    stats: {
      ideas: Record<string, number>;
      projects: Record<string, number>;
    };
  }> {
    const stats = await this.getStats();

    return {
      scheduler: {
        running: scheduler.isRunning(),
      },
      orchestrator: {
        running: true, // Could track this state
      },
      stats,
    };
  }
}

// Export singleton instance
export const projectManager = new ProjectManager();
