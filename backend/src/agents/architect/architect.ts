import { z } from 'zod';
import { BaseAgent } from '../base/base-agent.js';
import type { AgentTask, AgentResult, ExecutionContext, AgentCapabilities } from '../base/types.js';
import type { ArchitectureDesign } from '../base/types.js';
import { prompts } from '../../utils/prompts.js';
import { createLogger } from '../../utils/logger.js';
import { llmClientFactory } from '../../infra/llm-client.js';

const logger = createLogger('ArchitectAgent');

/**
 * Architecture design output schema
 */
const architectureDesignSchema = z.object({
  name: z.string(),
  description: z.string(),
  directoryStructure: z.record(z.unknown()),
  techStack: z.array(z.string()),
  components: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['frontend', 'backend', 'database', 'service', 'library', 'config']),
      description: z.string(),
      dependencies: z.array(z.string()),
      files: z.array(z.string()),
    })
  ),
  apis: z
    .array(
      z.object({
        path: z.string(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        description: z.string(),
        requestBody: z.record(z.unknown()).optional(),
        responseSchema: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  databaseSchema: z.record(z.unknown()).optional(),
  configFiles: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  dependencies: z
    .object({
      dependencies: z.record(z.string()),
      devDependencies: z.record(z.string()).optional(),
    })
    .optional(),
  buildCommands: z.array(z.string()).optional(),
});

/**
 * Agent capabilities
 */
const agentCapabilities: AgentCapabilities = {
  supportsParallel: false,
  maxRetries: 3,
  timeoutMs: 120000,
};

/**
 * ArchitectAgent - designs project structure and architecture
 */
export class ArchitectAgent extends BaseAgent {
  readonly name = 'ArchitectAgent';
  readonly description = 'Designs project structure and architecture';
  readonly version = '1.0.0';
  readonly capabilities = agentCapabilities;

  /**
   * Get the task type this agent handles
   */
  protected getTaskType(): string {
    return 'architecture';
  }

  /**
   * Build prompt for architecture design
   */
  protected buildPrompt(task: AgentTask, _context: ExecutionContext): string {
    const { idea } = task.input as { idea: Record<string, unknown> };

    if (!idea) {
      throw new Error('Idea input is required');
    }

    return prompts.architect.planStructure
      .replace('{title}', String(idea.title || ''))
      .replace('{description}', String(idea.description || ''))
      .replace('{projectType}', String(idea.projectType || ''))
      .replace('{features}', JSON.stringify(idea.features || []))
      .replace('{techStack}', JSON.stringify(idea.techStack || []))
      .replace('{complexity}', String(idea.complexity || 'medium'));
  }

  /**
   * Parse LLM response into ArchitectureDesign
   */
  protected async parseResponse(
    response: string,
    _context: ExecutionContext
  ): Promise<ArchitectureDesign> {
    // Try to extract JSON from the response
    const jsonMatch =
      response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return architectureDesignSchema.parse(parsed);
  }

  /**
   * Execute the actual task
   */
  protected async executeTask(task: AgentTask, context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing ArchitectAgent', { task: task.description });

      const prompt = this.buildPrompt(task, context);

      const llm = llmClientFactory.forArchitecture();

      const messages = [{ role: 'user' as const, content: prompt }];
      const response = await llm.invoke(messages);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const architecture = await this.parseResponse(content, context);

      logger.info('Architecture design created', {
        name: architecture.name,
        components: architecture.components.length,
      });

      return this.createSuccessResult(
        {
          architecture,
        },
        startTime,
        undefined,
        {
          recommendations: [
            'Proceed to CoderAgent to generate code based on this architecture',
          ],
        }
      );
    } catch (error) {
      logger.error('ArchitectAgent failed', error);
      return this.createErrorResult(error as Error, startTime);
    }
  }
}

/**
 * Design architecture for a project idea
 */
export async function designArchitecture(idea: {
  title: string;
  description: string;
  projectType: string;
  features: string[];
  techStack: string[];
  complexity: string;
}): Promise<ArchitectureDesign> {
  const agent = new ArchitectAgent();

  const result = await agent.execute(
    {
      type: 'architecture',
      priority: 8,
      description: `Design architecture for ${idea.title}`,
      input: { idea },
    },
    {
      executionId: `arch_${Date.now()}`,
      stage: 'architecture',
      iterationCount: 0,
      maxIterations: 1,
      metadata: {},
      startedAt: Date.now(),
      previousResults: new Map(),
    }
  );

  if (!result.success) {
    throw new Error('Architecture design failed: ' + result.error);
  }

  return (result.data as any).architecture;
}
