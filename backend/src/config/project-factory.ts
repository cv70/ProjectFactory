import { z } from 'zod';

// Server configuration schema
const ServerConfigSchema = z.object({
  port: z.coerce.number().default(8888),
});

// Database configuration schema
const DatabaseConfigSchema = z.object({
  path: z.string().default('./data/project-factory.db'),
});

// LLM configuration schema - allows empty apiKey for local Ollama
const LLMConfigSchema = z.object({
  baseUrl: z.string().default('http://localhost:11434/v1'),
  model: z.string().default('qwen3.5:4b'),
  apiKey: z.string().default(''), // Empty allowed for local Ollama
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  maxTokens: z.coerce.number().default(4096),
  timeout: z.coerce.number().default(120000),
});

// Workspace configuration schema
const WorkspaceConfigSchema = z.object({
  root: z.string().default('./projects'),
  activeDir: z.string().default('./projects/active'),
  completedDir: z.string().default('./projects/completed'),
  archivedDir: z.string().default('./projects/archived'),
  templatesDir: z.string().default('./templates'),
});

// Pipeline configuration schema
const PipelineConfigSchema = z.object({
  ideaGeneration: z.object({
    enabled: z.coerce.boolean().default(true),
    interval: z.coerce.number().default(60000), // 1 minute
    batchSize: z.coerce.number().default(3),
    maxQueueSize: z.coerce.number().default(100),
  }),
  projectDevelopment: z.object({
    enabled: z.coerce.boolean().default(true),
    maxConcurrent: z.coerce.number().default(5),
    autoPick: z.coerce.boolean().default(true),
  }),
  iteration: z.object({
    enabled: z.coerce.boolean().default(true),
    minQualityThreshold: z.coerce.number().default(70),
    maxIterationsPerProject: z.coerce.number().default(10),
  }),
});

// Quality thresholds schema
const QualityConfigSchema = z.object({
  minTestCoverage: z.coerce.number().default(80),
  maxLintErrors: z.coerce.number().default(0),
  minQualityScore: z.coerce.number().default(70),
  buildRequired: z.coerce.boolean().default(true),
});

// Resource limits schema
const ResourcesConfigSchema = z.object({
  maxCostPerDay: z.coerce.number().default(50),
  maxConcurrentProjects: z.coerce.number().default(5),
  maxRetries: z.coerce.number().default(3),
  requestTimeout: z.coerce.number().default(120000),
});

// Main configuration schema
export const ProjectFactoryConfigSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  llm: LLMConfigSchema,
  workspace: WorkspaceConfigSchema,
  pipeline: PipelineConfigSchema,
  quality: QualityConfigSchema,
  resources: ResourcesConfigSchema,
});

export type ProjectFactoryConfig = z.infer<typeof ProjectFactoryConfigSchema>;

// Default configuration - optimized for local Ollama
export const defaultConfig: ProjectFactoryConfig = {
  server: {
    port: 8888,
  },
  database: {
    path: './data/project-factory.db',
  },
  llm: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen3.5:4b',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000,
  },
  workspace: {
    root: './projects',
    activeDir: './projects/active',
    completedDir: './projects/completed',
    archivedDir: './projects/archived',
    templatesDir: './templates',
  },
  pipeline: {
    ideaGeneration: {
      enabled: true,
      interval: 60000,
      batchSize: 3,
      maxQueueSize: 100,
    },
    projectDevelopment: {
      enabled: true,
      maxConcurrent: 5,
      autoPick: true,
    },
    iteration: {
      enabled: true,
      minQualityThreshold: 70,
      maxIterationsPerProject: 10,
    },
  },
  quality: {
    minTestCoverage: 80,
    maxLintErrors: 0,
    minQualityScore: 70,
    buildRequired: true,
  },
  resources: {
    maxCostPerDay: 50,
    maxConcurrentProjects: 5,
    maxRetries: 3,
    requestTimeout: 120000,
  },
};