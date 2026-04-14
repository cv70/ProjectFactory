import type { Idea, Project, Iteration } from '../../drizzle/schema.js';
import type {
  ArchitectureDesign,
  GeneratedFile,
  TestResult,
  ReviewResult,
  QualityMetrics,
} from '../../agents/base/types.js';

/**
 * Project factory state for LangGraph workflow
 */
export interface ProjectFactoryState {
  // Project identification
  projectId?: string;
  ideaId?: string;

  // Data objects
  idea?: Idea;
  project?: Project;
  iteration?: Iteration;

  // Execution tracking
  currentAgent: string;
  stage: ProjectStage;
  step: number;
  totalSteps: number;

  // Intermediate results
  architecture?: ArchitectureDesign;
  generatedFiles?: GeneratedFile[];
  testResults?: TestResult;
  reviewResult?: ReviewResult;
  qualityMetrics?: QualityMetrics;

  // Iteration tracking
  iterationCount: number;
  maxIterations: number;
  qualityScore: number;

  // Error handling
  errors: Array<{ step: string; error: string; timestamp: number }>;
  retryCount: number;
  maxRetries: number;

  // Metadata
  metadata: Record<string, unknown>;
  startTime: number;
  lastUpdate: number;
}

/**
 * Project stages
 */
export type ProjectStage =
  | 'idea-generation'
  | 'architecture'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'optimizing'
  | 'git'
  | 'done'
  | 'failed';

/**
 * Stage transition
 */
export interface StageTransition {
  from: ProjectStage;
  to: ProjectStage;
  condition?: string;
}

/**
 * Quality gate result
 */
export interface QualityGateResult {
  passed: boolean;
  score: number;
  thresholds: QualityThresholds;
  failures: string[];
  warnings: string[];
}

/**
 * Quality thresholds
 */
export interface QualityThresholds {
  minTestCoverage: number;
  maxLintErrors: number;
  minQualityScore: number;
  requireBuildSuccess: boolean;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  qualityScore?: number;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  /** Maximum iterations for optimization */
  maxIterations: number;
  /** Maximum retries for failed steps */
  maxRetries: number;
  /** Quality thresholds */
  qualityThresholds: QualityThresholds;
  /** Whether to enable auto-optimization */
  enableAutoOptimization: boolean;
  /** Whether to enable git integration */
  enableGit: boolean;
  /** Whether to continue on non-critical errors */
  continueOnWarning: boolean;
  /** Timeout for each step in milliseconds */
  stepTimeoutMs: number;
  /** Total workflow timeout in milliseconds */
  workflowTimeoutMs: number;
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxIterations: 3,
  maxRetries: 3,
  qualityThresholds: {
    minTestCoverage: 80,
    maxLintErrors: 0,
    minQualityScore: 70,
    requireBuildSuccess: true,
  },
  enableAutoOptimization: true,
  enableGit: true,
  continueOnWarning: true,
  stepTimeoutMs: 300000, // 5 minutes
  workflowTimeoutMs: 3600000, // 1 hour
};

/**
 * Node names in the graph
 */
export const GRAPH_NODES = {
  START: 'start',
  IDEA_GENERATOR: 'idea-generator',
  ARCHITECT: 'architect',
  CODER: 'coder',
  TESTER: 'tester',
  REVIEWER: 'reviewer',
  QUALITY_GATE: 'quality-gate',
  OPTIMIZER: 'optimizer',
  GIT: 'git',
  END: 'end',
  ERROR: 'error',
} as const;

/**
 * Edge names in the graph
 */
export const GRAPH_EDGES = {
  TO_ARCHITECT: 'to-architect',
  TO_CODER: 'to-coder',
  TO_TESTER: 'to-tester',
  TO_REVIEWER: 'to-reviewer',
  TO_QUALITY_GATE: 'to-quality-gate',
  TO_OPTIMIZER: 'to-optimizer',
  TO_GIT: 'to-git',
  TO_END: 'to-end',
  TO_ERROR: 'to-error',
  RETRY_CODER: 'retry-coder',
  RETRY_TESTER: 'retry-tester',
} as const;

/**
 * Workflow event
 */
export interface WorkflowEvent {
  type: 'started' | 'stage-changed' | 'agent-completed' | 'agent-failed' | 'completed' | 'failed' | 'warning';
  timestamp: number;
  data: {
    stage?: ProjectStage;
    agent?: string;
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
}
