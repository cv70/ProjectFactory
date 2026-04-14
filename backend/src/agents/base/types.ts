import type { Idea, Project, Iteration } from '../../drizzle/schema.js';

/**
 * Agent execution status
 */
export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'paused';

/**
 * Stage of the project lifecycle
 */
export type ProjectStage =
  | 'idea-generation'
  | 'architecture'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'optimizing'
  | 'git'
  | 'done';

/**
 * Agent execution context - passed to each agent during execution
 */
export interface ExecutionContext {
  /** Unique execution ID */
  executionId: string;
  /** Project ID if associated with a project */
  projectId?: string;
  /** Idea ID if processing an idea */
  ideaId?: string;
  /** Current project stage */
  stage: ProjectStage;
  /** Current iteration number */
  iterationCount: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Timestamp when execution started */
  startedAt: number;
  /** Idea data if available */
  idea?: Idea;
  /** Project data if available */
  project?: Project;
  /** Iteration data if available */
  iteration?: Iteration;
  /** Previous agent results */
  previousResults: Map<string, AgentResult>;
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
  /** Whether the execution was successful */
  success: boolean;
  /** Agent name that produced this result */
  agentName: string;
  /** Execution status */
  status: AgentStatus;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error details */
  errorDetails?: unknown;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Token usage if LLM was used */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost incurred */
  cost?: number;
  /** Quality score of the output (0-100) */
  qualityScore?: number;
  /** Recommendations for next steps */
  recommendations?: string[];
  /** Files created or modified */
  filesChanged?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  /** Can this agent handle parallel execution */
  supportsParallel: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Requires specific resources */
  requiredResources?: string[];
}

/**
 * Task that can be handled by an agent
 */
export interface AgentTask {
  /** Task type identifier */
  type: string;
  /** Task priority (1-10, higher = more important) */
  priority: number;
  /** Task description */
  description: string;
  /** Task input data */
  input: unknown;
  /** Expected output type */
  expectedOutput?: string;
  /** Task dependencies */
  dependencies?: string[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Quality metrics from an agent execution
 */
export interface QualityMetrics {
  /** Overall quality score (0-100) */
  overall: number;
  /** Code quality (0-100) */
  codeQuality?: number;
  /** Test coverage (0-100) */
  testCoverage?: number;
  /** Documentation score (0-100) */
  documentation?: number;
  /** Security score (0-100) */
  security?: number;
  /** Performance score (0-100) */
  performance?: number;
  /** Maintainability score (0-100) */
  maintainability?: number;
}

/**
 * Generated file representation
 */
export interface GeneratedFile {
  /** Relative path from project root */
  path: string;
  /** File content */
  content: string;
  /** File language/type */
  language: string;
  /** File size in bytes */
  size: number;
  /** Whether this file is created or modified */
  isNew: boolean;
}

/**
 * Architecture design result
 */
export interface ArchitectureDesign {
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Directory structure */
  directoryStructure: Record<string, unknown>;
  /** Technology stack */
  techStack: string[];
  /** Key components */
  components: ArchitectureComponent[];
  /** API definitions */
  apis?: ApiDefinition[];
  /** Database schema */
  databaseSchema?: Record<string, unknown>;
  /** Configuration files */
  configFiles: GeneratedFile[];
}

/**
 * Architecture component
 */
export interface ArchitectureComponent {
  /** Component name */
  name: string;
  /** Component type */
  type: 'frontend' | 'backend' | 'database' | 'service' | 'library' | 'config';
  /** Component description */
  description: string;
  /** Dependencies */
  dependencies: string[];
  /** Files to generate */
  files: string[];
}

/**
 * API definition
 */
export interface ApiDefinition {
  /** Endpoint path */
  path: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Description */
  description: string;
  /** Request body schema */
  requestBody?: Record<string, unknown>;
  /** Response schema */
  responseSchema?: Record<string, unknown>;
}

/**
 * Test result from TesterAgent
 */
export interface TestResult {
  /** Total tests */
  totalTests: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Test coverage percentage */
  coverage: number;
  /** Test duration in milliseconds */
  duration: number;
  /** Test output */
  output?: string;
  /** Individual test results */
  testCases?: TestCaseResult[];
}

/**
 * Individual test case result
 */
export interface TestCaseResult {
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped';
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Review result from ReviewerAgent
 */
export interface ReviewResult {
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Lint issues */
  lintIssues: LintIssue[];
  /** Security issues */
  securityIssues: SecurityIssue[];
  /** Performance issues */
  performanceIssues: PerformanceIssue[];
  /** Code smells */
  codeSmells: CodeSmell[];
  /** Recommendations */
  recommendations: string[];
  /** Files reviewed */
  filesReviewed: string[];
}

/**
 * Lint issue
 */
export interface LintIssue {
  /** Issue file */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue message */
  message: string;
  /** Rule ID */
  ruleId?: string;
}

/**
 * Security issue
 */
export interface SecurityIssue {
  /** Issue type */
  type: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Description */
  description: string;
  /** Recommendation */
  recommendation: string;
}

/**
 * Performance issue
 */
export interface PerformanceIssue {
  /** Issue type */
  type: string;
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Description */
  description: string;
  /** Impact level */
  impact: 'high' | 'medium' | 'low';
  /** Suggestion */
  suggestion: string;
}

/**
 * Code smell
 */
export interface CodeSmell {
  /** Smell type */
  type: string;
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}