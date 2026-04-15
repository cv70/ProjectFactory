import { createLogger } from '../utils/logger.js';
import { ideaRepository } from '../domain/idea/persistence.js';
import { projectRepository } from '../domain/project/persistence.js';
import { generateIdeas } from '../agents/idea-generator/idea-generator.js';
import { designArchitecture } from '../agents/architect/architect.js';
import { generateCode } from '../agents/coder/coder.js';
import { filesystem } from '../infra/filesystem.js';
import { config } from '../config/index.js';
import type { ProjectFactoryState } from './langgraph/types.js';

const logger = createLogger('SimpleOrchestrator');

/**
 * Simple orchestrator for linear workflow: Idea -> Architecture -> Code
 */
export class SimpleOrchestrator {
  private running = false;

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Orchestrator is already running');
      return;
    }

    this.running = true;
    logger.info('Simple orchestrator started');
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    this.running = false;
    logger.info('Simple orchestrator stopped');
  }

  /**
   * Check if orchestrator is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Run idea generation cycle
   */
  async runIdeaGeneration(): Promise<void> {
    logger.info('Running idea generation cycle');

    try {
      const batchSize = config.pipeline.ideaGeneration.batchSize;
      const result = await generateIdeas(batchSize);

      logger.info('Generated ideas', {
        count: result.ideas.length,
        overallScore: result.critique.overallScore,
      });
    } catch (error) {
      logger.error('Idea generation failed', error);
    }
  }

  /**
   * Pick next queued idea and develop it
   */
  async pickAndDevelopIdea(): Promise<{ success: boolean; projectId?: string; error?: string }> {
    try {
      // Get next queued idea
      const idea = await ideaRepository.getNextQueued();
      if (!idea) {
        logger.debug('No queued ideas found');
        return { success: false, error: 'No queued ideas' };
      }

      return await this.developIdea(idea);
    } catch (error) {
      logger.error('Failed to pick and develop idea', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Develop a specific idea by ID (for manual trigger)
   */
  async pickAndDevelopIdeaForIdea(ideaId: string): Promise<{ success: boolean; projectId?: string; error?: string }> {
    try {
      const idea = await ideaRepository.findById(ideaId);
      if (!idea) {
        logger.debug('Idea not found', { ideaId });
        return { success: false, error: 'Idea not found' };
      }

      return await this.developIdea(idea);
    } catch (error) {
      logger.error('Failed to develop idea', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Internal method to develop an idea
   */
  private async developIdea(idea: any): Promise<{ success: boolean; projectId?: string; error?: string }> {
    logger.info('Picked idea for development', { ideaId: idea.id, title: idea.title });

    // Update idea status
    await ideaRepository.updateStatus(idea.id, 'in_progress');

    // Create project
    const projectPath = `${config.workspace.activeDir}/${idea.id}`;
    await filesystem.ensureDir(projectPath);

    const project = await projectRepository.create({
      ideaId: idea.id,
      name: idea.title,
      description: idea.description,
      type: idea.projectType as any,
      path: projectPath,
      status: 'initializing',
    });

    logger.info('Created project', { projectId: project.id, path: projectPath });

    // Run development workflow
    const workflowResult = await this.runDevelopmentWorkflow(project.id, idea, projectPath);

    if (workflowResult.success) {
      await projectRepository.markCompleted(project.id);
      await ideaRepository.updateStatus(idea.id, 'completed');
      logger.info('Project completed successfully', { projectId: project.id });
      return { success: true, projectId: project.id };
    } else {
      await projectRepository.markFailed(project.id, workflowResult.error);
      await ideaRepository.updateStatus(idea.id, 'failed', workflowResult.error);
      logger.error('Project failed', { projectId: project.id, error: workflowResult.error });
      return { success: false, error: workflowResult.error, projectId: project.id };
    }
  }

  /**
   * Run the development workflow for a project
   */
  private async runDevelopmentWorkflow(
    projectId: string,
    idea: any,
    projectPath: string
  ): Promise<{ success: boolean; error?: string }> {
    logger.info('Starting development workflow', { projectId });

    try {
      // Stage 1: Architecture Design
      logger.info('Stage: Architecture', { projectId });
      await projectRepository.updateStatus(projectId, 'generating');

      const architecture = await designArchitecture({
        title: idea.title,
        description: idea.description,
        projectType: idea.projectType,
        features: idea.features,
        techStack: idea.techStack,
        complexity: idea.complexity,
      });

      // Save architecture to project
      await projectRepository.update(projectId, {
        architecture: architecture as any,
      });

      logger.info('Architecture designed', { projectId, components: architecture.components.length });

      // Stage 2: Code Generation
      logger.info('Stage: Coding', { projectId });

      const codeResult = await generateCode(
        {
          title: idea.title,
          description: idea.description,
          projectType: idea.projectType,
          features: idea.features,
          techStack: idea.techStack,
        },
        architecture as unknown as Record<string, unknown>,
        projectPath
      );

      logger.info('Code generated', { projectId, files: codeResult.files.length });

      // Create README with instructions
      const readme = `# ${idea.title}

${idea.description}

## Tech Stack
${idea.techStack.join(', ')}

## Features
${idea.features.map((f: string) => `- ${f}`).join('\n')}

## Installation
\`\`\`bash
npm install
\`\`\`

${codeResult.installationInstructions || ''}

## Usage
\`\`\`
${codeResult.usageInstructions || 'See individual package documentation'}
\`\`\`
`;
      await filesystem.writeFile(`${projectPath}/README.md`, readme);

      // Mark as completed for MVP (skip testing/reviewing for now)
      logger.info('Development workflow completed', { projectId });
      return { success: true };
    } catch (error) {
      logger.error('Development workflow failed', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

// Export singleton instance
export const orchestrator = new SimpleOrchestrator();
