import { z } from 'zod';
import { ProjectFactoryConfigSchema } from './project-factory.js';

// Environment variable validation schema
const EnvSchema = z.object({
  // Server
  PORT: z.string().default('8888'),

  // Database
  DATABASE_PATH: z.string().default('./data/project-factory.db'),

  // LLM - Ollama allows empty API key for local deployments
  LLM_BASE_URL: z.string().default('http://localhost:11434/v1'),
  LLM_MODEL: z.string().default('qwen3.5:4b'),
  LLM_API_KEY: z.string().default(''),
  LLM_TEMPERATURE: z.string().default('0.7'),

  // Workspace
  WORKSPACE_ROOT: z.string().default('./projects'),

  // Pipeline
  PIPELINE_IDEA_GENERATION_ENABLED: z.string().default('true'),
  PIPELINE_IDEA_GENERATION_INTERVAL: z.string().default('60000'),
  PIPELINE_PROJECT_DEVELOPMENT_ENABLED: z.string().default('true'),
  PIPELINE_ITERATION_ENABLED: z.string().default('true'),

  // Quality thresholds
  QUALITY_MIN_TEST_COVERAGE: z.string().default('80'),
  QUALITY_MAX_LINT_ERRORS: z.string().default('0'),
  QUALITY_MIN_QUALITY_SCORE: z.string().default('70'),

  // Resource limits
  RESOURCES_MAX_COST_PER_DAY: z.string().default('50'),
  RESOURCES_MAX_CONCURRENT_PROJECTS: z.string().default('5'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate environment variables
 */
export function validateEnv(env: Record<string, string | undefined>): Env {
  try {
    return EnvSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid environment configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Environment validation failed');
    }
    throw error;
  }
}

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown) {
  try {
    return ProjectFactoryConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid ProjectFactory configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Configuration validation failed');
    }
    throw error;
  }
}

/**
 * Validate partial configuration (for updates)
 */
export function validatePartialConfig(config: unknown) {
  return ProjectFactoryConfigSchema.partial().safeParse(config);
}
