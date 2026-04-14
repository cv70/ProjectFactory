import { z } from 'zod';
import { BaseAgent } from '../base/base-agent.js';
import type { AgentTask, AgentResult, ExecutionContext, AgentCapabilities } from '../base/types.js';
import { prompts } from '../../utils/prompts.js';
import { ideaRepository } from '../../domain/idea/persistence.js';
import { createLogger } from '../../utils/logger.js';
import { llmClientFactory } from '../../infra/llm-client.js';

const logger = createLogger('IdeaGeneratorAgent');

/**
 * Idea generation modes
 */
type IdeaMode = 'planner' | 'executor' | 'critic';

/**
 * Planner output schema
 */
const plannerOutputSchema = z.object({
  strategy: z.string(),
  dimensions: z.record(z.string()),
  focusAreas: z.array(z.string()),
});

/**
 * Executor output schema - single idea
 */
const ideaSchema = z.object({
  title: z.string(),
  description: z.string(),
  projectType: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),
  features: z.array(z.string()),
  techStack: z.array(z.string()),
  targetAudience: z.string(),
  complexity: z.enum(['low', 'medium', 'high']),
});

/**
 * Executor output schema - array of ideas
 */
const executorOutputSchema = z.array(ideaSchema);

/**
 * Critic output schema
 */
const criticOutputSchema = z.object({
  overallScore: z.number(),
  evaluations: z.array(
    z.object({
      id: z.string().optional(),
      score: z.number(),
      feedback: z.string(),
      action: z.enum(['keep', 'improve', 'reject']),
    })
  ),
  suggestions: z.array(z.string()),
});

/**
 * Agent capabilities
 */
const agentCapabilities: AgentCapabilities = {
  supportsParallel: true,
  maxRetries: 3,
  timeoutMs: 120000,
};

/**
 * IdeaGeneratorAgent - generates project ideas using Planner -> Executor -> Critic workflow
 */
export class IdeaGeneratorAgent extends BaseAgent {
  readonly name = 'IdeaGeneratorAgent';
  readonly description = 'Generates diverse and high-quality project ideas';
  readonly version = '1.0.0';
  readonly capabilities = agentCapabilities;

  private mode: IdeaMode;

  constructor(config?: { mode?: IdeaMode }) {
    super(config as any);
    this.mode = config?.mode || 'executor';
  }

  /**
   * Set the agent mode (planner, executor, or critic)
   */
  setMode(mode: IdeaMode): void {
    this.mode = mode;
    logger.debug('Mode set', { mode });
  }

  /**
   * Get the task type this agent handles
   */
  protected getTaskType(): string {
    return 'idea-generation';
  }

  /**
   * Build prompt based on current mode and task
   */
  protected buildPrompt(task: AgentTask, _context: ExecutionContext): string {
    const { batchSize = 3 } = (task.input as Record<string, unknown>) || {};

    switch (this.mode) {
      case 'planner':
        return prompts.ideaGeneration.planner.replace('{batchSize}', String(batchSize));

      case 'executor':
        const plan = task.input?.plan || task.metadata?.plan || '';
        return prompts.ideaGeneration.executor
          .replace('{batchSize}', String(batchSize))
          .replace('{plan}', String(plan));

      case 'critic':
        const ideas = task.input?.ideas || [];
        return prompts.ideaGeneration.critic.replace('{ideas}', JSON.stringify(ideas, null, 2));

      default:
        throw new Error(`Unknown mode: ${this.mode}`);
    }
  }

  /**
   * Parse LLM response based on mode
   */
  protected async parseResponse(
    response: string,
    _context: ExecutionContext
  ): Promise<unknown> {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    switch (this.mode) {
      case 'planner':
        return plannerOutputSchema.parse(parsed);

      case 'executor':
        if (Array.isArray(parsed)) {
          return executorOutputSchema.parse(parsed);
        }
        // Handle wrapped response { ideas: [...] }
        if (parsed.ideas) {
          return executorOutputSchema.parse(parsed.ideas);
        }
        throw new Error('Unexpected executor response format');

      case 'critic':
        return criticOutputSchema.parse(parsed);

      default:
        throw new Error(`Unknown mode: ${this.mode}`);
    }
  }

  /**
   * Execute the actual task
   */
  protected async executeTask(task: AgentTask, context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing IdeaGeneratorAgent', { mode: this.mode, task: task.description });

      const prompt = this.buildPrompt(task, context);

      // Create LLM client using factory
      const llm = llmClientFactory.forIdeaGeneration();

      const messages = [{ role: 'user' as const, content: prompt }];
      const response = await llm.invoke(messages);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const parsed = await this.parseResponse(content, context);

      // Store ideas to database if in executor mode
      if (this.mode === 'executor' && Array.isArray(parsed)) {
        const ideas = parsed as z.infer<typeof executorOutputSchema>;
        for (const idea of ideas) {
          await ideaRepository.create({
            title: idea.title,
            description: idea.description,
            projectType: idea.projectType,
            features: idea.features,
            techStack: idea.techStack,
            targetAudience: idea.targetAudience,
            complexity: idea.complexity,
            status: 'pending',
          });
        }
        logger.info('Created ideas in database', { count: ideas.length });
      }

      return this.createSuccessResult(
        {
          mode: this.mode,
          ideas: parsed,
          count: Array.isArray(parsed) ? parsed.length : 1,
        },
        startTime,
        undefined,
        {
          recommendations: ['Add ideas to queue for development'],
        }
      );
    } catch (error) {
      logger.error('IdeaGeneratorAgent failed', error);
      return this.createErrorResult(error as Error, startTime);
    }
  }
}

/**
 * Generate ideas using the full Planner -> Executor -> Critic workflow
 */
export async function generateIdeas(batchSize: number = 3): Promise<{
  ideas: z.infer<typeof executorOutputSchema>;
  plan: z.infer<typeof plannerOutputSchema>;
  critique: z.infer<typeof criticOutputSchema>;
}> {
  const plannerAgent = new IdeaGeneratorAgent({ mode: 'planner' });
  const executorAgent = new IdeaGeneratorAgent({ mode: 'executor' });
  const criticAgent = new IdeaGeneratorAgent({ mode: 'critic' });

  // Step 1: Planner creates strategy
  const planResult = await plannerAgent.execute(
    {
      type: 'idea-generation',
      priority: 5,
      description: 'Generate idea plan',
      input: { batchSize },
    },
    {
      executionId: `ig_${Date.now()}`,
      stage: 'idea-generation',
      iterationCount: 0,
      maxIterations: 1,
      metadata: {},
      startedAt: Date.now(),
      previousResults: new Map(),
    }
  );

  if (!planResult.success) {
    throw new Error('Planning failed: ' + planResult.error);
  }

  // Step 2: Executor generates ideas based on plan
  const executorResult = await executorAgent.execute(
    {
      type: 'idea-generation',
      priority: 5,
      description: 'Generate ideas based on plan',
      input: { batchSize, plan: planResult.data },
    },
    {
      executionId: `ig_${Date.now()}`,
      stage: 'idea-generation',
      iterationCount: 0,
      maxIterations: 1,
      metadata: { plan: planResult.data },
      startedAt: Date.now(),
      previousResults: new Map(),
    }
  );

  if (!executorResult.success) {
    throw new Error('Idea execution failed: ' + executorResult.error);
  }

  // Step 3: Critic evaluates ideas
  const criticResult = await criticAgent.execute(
    {
      type: 'idea-generation',
      priority: 5,
      description: 'Evaluate generated ideas',
      input: { ideas: executorResult.data },
    },
    {
      executionId: `ig_${Date.now()}`,
      stage: 'idea-generation',
      iterationCount: 0,
      maxIterations: 1,
      metadata: {},
      startedAt: Date.now(),
      previousResults: new Map(),
    }
  );

  if (!criticResult.success) {
    throw new Error('Critique failed: ' + criticResult.error);
  }

  // Filter ideas based on critic feedback
  const allIdeas = executorResult.data as any;
  const critique = criticResult.data as any;
  const approvedIdeas = allIdeas.filter((idea: any, idx: number) => {
    const eval_ = critique.evaluations?.[idx];
    return !eval_ || eval_.action !== 'reject';
  });

  return {
    ideas: approvedIdeas,
    plan: planResult.data as any,
    critique,
  };
}
