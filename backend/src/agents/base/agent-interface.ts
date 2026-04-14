import type {
  AgentTask,
  AgentResult,
  AgentCapabilities,
  ExecutionContext,
} from './types.js';

/**
 * Agent Interface - all agents must implement this interface
 *
 * This interface defines the contract that all agents must follow.
 * It provides a standard way for the system to interact with agents.
 */
export interface AgentInterface {
  /** Unique agent identifier */
  readonly name: string;

  /** Human-readable agent description */
  readonly description: string;

  /** Agent version */
  readonly version: string;

  /** Agent capabilities */
  readonly capabilities: AgentCapabilities;

  /**
   * Check if this agent can handle a given task
   * @param task The task to check
   * @returns true if the agent can handle this task
   */
  canHandle(task: AgentTask): boolean | Promise<boolean>;

  /**
   * Execute the agent with a given task and context
   * @param task The task to execute
   * @param context The execution context
   * @returns Promise resolving to the agent result
   */
  execute(task: AgentTask, context: ExecutionContext): Promise<AgentResult>;

  /**
   * Validate the agent's configuration
   * @returns true if configuration is valid
   */
  validateConfig?(): boolean | Promise<boolean>;

  /**
   * Initialize the agent (called once before first execution)
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup agent resources (called before shutdown)
   */
  cleanup?(): Promise<void>;

  /**
   * Get agent health status
   * @returns Health status information
   */
  getHealth?(): AgentHealthStatus;

  /**
   * Get agent statistics
   * @returns Statistics about agent executions
   */
  getStats?(): AgentStats;
}

/**
 * Agent health status
 */
export interface AgentHealthStatus {
  /** Agent name */
  agentName: string;
  /** Whether the agent is healthy */
  isHealthy: boolean;
  /** Health message */
  message: string;
  /** Last check timestamp */
  checkedAt: number;
  /** Additional health data */
  data?: Record<string, unknown>;
}

/**
 * Agent execution statistics
 */
export interface AgentStats {
  /** Agent name */
  agentName: string;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time in milliseconds */
  avgExecutionTimeMs: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total cost incurred */
  totalCost: number;
  /** Last execution timestamp */
  lastExecutionAt?: number;
  /** Average quality score */
  avgQualityScore: number;
}
