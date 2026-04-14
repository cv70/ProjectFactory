import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage, BaseChatMessageHistory } from '@langchain/core/messages';
import { createLogger } from '../../utils/logger.js';
import type {
  AgentTask,
  AgentResult,
  AgentCapabilities,
  ExecutionContext,
} from './types.js';
import type { AgentInterface, AgentHealthStatus, AgentStats } from './agent-interface.js';

/**
 * Base Agent - abstract class that all concrete agents should extend
 *
 * Provides common functionality for:
 * - LLM client management
 * - Logging
 * - Retry logic
 * - Token usage tracking
 * - Cost calculation
 * - Execution timing
 */
export abstract class BaseAgent implements AgentInterface {
  protected logger = createLogger(this.name);
  protected llm: ChatOpenAI;
  protected stats: AgentStats = {
    agentName: this.name,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTimeMs: 0,
    totalTokens: 0,
    totalCost: 0,
    avgQualityScore: 0,
  };

  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;
  abstract readonly capabilities: AgentCapabilities;

  /**
   * Constructor for BaseAgent
   * @param config Agent configuration
   */
  constructor(config?: AgentConfig) {
    // Initialize LLM client with default or provided config
    this.llm = new ChatOpenAI({
      modelName: config?.model ?? 'gpt-4o-mini',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 4096,
      timeout: config?.timeoutMs ?? this.capabilities.timeoutMs,
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Check if this agent can handle a given task
   * Default implementation checks task type
   */
  canHandle(task: AgentTask): boolean | Promise<boolean> {
    return task.type === this.getTaskType();
  }

  /**
   * Execute the agent with retry logic
   */
  async execute(task: AgentTask, context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    this.stats.totalExecutions++;

    this.logger.info(`Executing task: ${task.description}`, {
      taskId: task.type,
      projectId: context.projectId,
      stage: context.stage,
    });

    let lastError: Error | undefined;
    let result: AgentResult | undefined;

    // Execute with retry logic
    for (let attempt = 1; attempt <= this.capabilities.maxRetries; attempt++) {
      try {
        this.logger.debug(`Attempt ${attempt}/${this.capabilities.maxRetries}`);

        // Set previous results in context
        context.previousResults.set(this.name, await this.executeTask(task, context));

        result = context.previousResults.get(this.name)!;

        // Update stats on success
        if (result.success) {
          this.stats.successfulExecutions++;
          this.stats.lastExecutionAt = startTime;
          this.updateTimingStats(startTime, result.executionTimeMs);

          if (result.tokenUsage) {
            this.stats.totalTokens += result.tokenUsage.totalTokens;
          }
          if (result.cost) {
            this.stats.totalCost += result.cost;
          }
          if (result.qualityScore !== undefined) {
            this.updateQualityStats(result.qualityScore);
          }

          this.logger.info(`Task completed successfully`, {
            duration: result.executionTimeMs,
            tokens: result.tokenUsage?.totalTokens,
            cost: result.cost,
            qualityScore: result.qualityScore,
          });
        }

        break;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Attempt ${attempt} failed`, {
          error: lastError.message,
          stack: lastError.stack,
        });

        // If not the last attempt, wait before retrying
        if (attempt < this.capabilities.maxRetries) {
          const waitTime = this.calculateBackoff(attempt);
          this.logger.debug(`Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    // If all retries failed
    if (!result || !result.success) {
      this.stats.failedExecutions++;
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        agentName: this.name,
        status: 'failed',
        error: lastError?.message ?? 'Unknown error',
        errorDetails: lastError,
        executionTimeMs: executionTime,
      };
    }

    return result;
  }

  /**
   * Execute the actual task - to be implemented by concrete agents
   */
  protected abstract executeTask(task: AgentTask, context: ExecutionContext): Promise<AgentResult>;

  /**
   * Get the task type this agent handles
   */
  protected abstract getTaskType(): string;

  /**
   * Build a prompt for the LLM - to be implemented by concrete agents
   */
  protected abstract buildPrompt(task: AgentTask, context: ExecutionContext): string;

  /**
   * Parse the LLM response - to be implemented by concrete agents
   */
  protected abstract parseResponse(response: string, context: ExecutionContext): Promise<unknown>;

  /**
   * Default validation - assumes config is valid
   */
  validateConfig(): boolean {
    try {
      return !!process.env.OPENAI_API_KEY;
    } catch {
      return false;
    }
  }

  /**
   * Default initialize - no-op
   */
  async initialize(): Promise<void> {
    this.logger.info('Agent initialized');
  }

  /**
   * Default cleanup - no-op
   */
  async cleanup(): Promise<void> {
    this.logger.info('Agent cleaned up');
  }

  /**
   * Get agent health status
   */
  getHealth(): AgentHealthStatus {
    const isHealthy = this.validateConfig();

    return {
      agentName: this.name,
      isHealthy,
      message: isHealthy ? 'Agent is healthy' : 'Agent configuration is invalid',
      checkedAt: Date.now(),
      data: {
        ...this.stats,
        capabilities: this.capabilities,
      },
    };
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * Calculate exponential backoff time
   */
  protected calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add some jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update timing statistics
   */
  protected updateTimingStats(startTime: number, executionTime: number): void {
    const { avgExecutionTimeMs, totalExecutions } = this.stats;
    this.stats.avgExecutionTimeMs =
      (avgExecutionTimeMs * (totalExecutions - 1) + executionTime) / totalExecutions;
  }

  /**
   * Update quality statistics
   */
  protected updateQualityStats(qualityScore: number): void {
    const { avgQualityScore, successfulExecutions } = this.stats;
    this.stats.avgQualityScore =
      (avgQualityScore * (successfulExecutions - 1) + qualityScore) / successfulExecutions;
  }

  /**
   * Estimate cost based on token usage
   */
  protected calculateCost(tokenUsage: { promptTokens: number; completionTokens: number }): number {
    // Approximate costs for GPT-4 (adjust based on actual model)
    const INPUT_COST_PER_1K = 0.03;
    const OUTPUT_COST_PER_1K = 0.06;

    return (
      (tokenUsage.promptTokens / 1000) * INPUT_COST_PER_1K +
      (tokenUsage.completionTokens / 1000) * OUTPUT_COST_PER_1K
    );
  }

  /**
   * Invoke the LLM and track token usage
   */
  protected async invokeLLM(messages: BaseMessage[]): Promise<{ content: string; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const response = await this.llm.invoke(messages);

    const promptTokens = response.usage_metadata?.input_tokens ?? 0;
    const completionTokens = response.usage_metadata?.output_tokens ?? 0;

    return {
      content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  /**
   * Create a basic error result
   */
  protected createErrorResult(error: Error, startTime: number): AgentResult {
    return {
      success: false,
      agentName: this.name,
      status: 'failed',
      error: error.message,
      errorDetails: {
        name: error.name,
        stack: error.stack,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Create a basic success result
   */
  protected createSuccessResult<T>(
    data: T,
    startTime: number,
    tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number },
    additionalFields?: Partial<AgentResult<T>>
  ): AgentResult<T> {
    const executionTime = Date.now() - startTime;
    const cost = tokenUsage ? this.calculateCost(tokenUsage) : undefined;

    return {
      success: true,
      agentName: this.name,
      status: 'success',
      data,
      executionTimeMs: executionTime,
      tokenUsage,
      cost,
      ...additionalFields,
    };
  }
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** LLM model to use */
  model?: string;
  /** Temperature for LLM */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** OpenAI API key */
  apiKey?: string;
  /** Additional configuration */
  [key: string]: unknown;
}
