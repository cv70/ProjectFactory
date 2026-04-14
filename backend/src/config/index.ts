import { validateEnv, type Env } from './validation.js';
import { defaultConfig, type ProjectFactoryConfig } from './project-factory.js';

/**
 * Load and validate environment variables
 */
function loadEnv(): Env {
  const env: Record<string, string | undefined> = {
    PORT: process.env.PORT,
    DATABASE_PATH: process.env.DATABASE_PATH,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
    WORKSPACE_ROOT: process.env.WORKSPACE_ROOT,
    PIPELINE_IDEA_GENERATION_ENABLED: process.env.PIPELINE_IDEA_GENERATION_ENABLED,
    PIPELINE_IDEA_GENERATION_INTERVAL: process.env.PIPELINE_IDEA_GENERATION_INTERVAL,
    PIPELINE_PROJECT_DEVELOPMENT_ENABLED: process.env.PIPELINE_PROJECT_DEVELOPMENT_ENABLED,
    PIPELINE_ITERATION_ENABLED: process.env.PIPELINE_ITERATION_ENABLED,
    QUALITY_MIN_TEST_COVERAGE: process.env.QUALITY_MIN_TEST_COVERAGE,
    QUALITY_MAX_LINT_ERRORS: process.env.QUALITY_MAX_LINT_ERRORS,
    QUALITY_MIN_QUALITY_SCORE: process.env.QUALITY_MIN_QUALITY_SCORE,
    RESOURCES_MAX_COST_PER_DAY: process.env.RESOURCES_MAX_COST_PER_DAY,
    RESOURCES_MAX_CONCURRENT_PROJECTS: process.env.RESOURCES_MAX_CONCURRENT_PROJECTS,
  };
  return validateEnv(env);
}

/**
 * Build configuration from environment variables
 */
function buildConfigFromEnv(env: Env): ProjectFactoryConfig {
  return {
    server: {
      port: parseInt(env.PORT, 10),
    },
    database: {
      path: env.DATABASE_PATH,
    },
    llm: {
      baseUrl: env.LLM_BASE_URL,
      model: env.LLM_MODEL,
      apiKey: env.LLM_API_KEY,
      temperature: parseFloat(env.LLM_TEMPERATURE),
      maxTokens: 4096,
      timeout: 120000,
    },
    workspace: {
      root: env.WORKSPACE_ROOT,
      activeDir: `${env.WORKSPACE_ROOT}/active`,
      completedDir: `${env.WORKSPACE_ROOT}/completed`,
      archivedDir: `${env.WORKSPACE_ROOT}/archived`,
      templatesDir: './templates',
    },
    pipeline: {
      ideaGeneration: {
        enabled: env.PIPELINE_IDEA_GENERATION_ENABLED === 'true',
        interval: parseInt(env.PIPELINE_IDEA_GENERATION_INTERVAL, 10),
        batchSize: 3,
        maxQueueSize: 100,
      },
      projectDevelopment: {
        enabled: env.PIPELINE_PROJECT_DEVELOPMENT_ENABLED === 'true',
        maxConcurrent: parseInt(env.RESOURCES_MAX_CONCURRENT_PROJECTS, 10),
        autoPick: true,
      },
      iteration: {
        enabled: env.PIPELINE_ITERATION_ENABLED === 'true',
        minQualityThreshold: parseInt(env.QUALITY_MIN_QUALITY_SCORE, 10),
        maxIterationsPerProject: 10,
      },
    },
    quality: {
      minTestCoverage: parseInt(env.QUALITY_MIN_TEST_COVERAGE, 10),
      maxLintErrors: parseInt(env.QUALITY_MAX_LINT_ERRORS, 10),
      minQualityScore: parseInt(env.QUALITY_MIN_QUALITY_SCORE, 10),
      buildRequired: true,
    },
    resources: {
      maxCostPerDay: parseInt(env.RESOURCES_MAX_COST_PER_DAY, 10),
      maxConcurrentProjects: parseInt(env.RESOURCES_MAX_CONCURRENT_PROJECTS, 10),
      maxRetries: 3,
      requestTimeout: 120000,
    },
  };
}

/**
 * Load configuration (from environment variables)
 */
export function loadConfig(): ProjectFactoryConfig {
  const env = loadEnv();
  return buildConfigFromEnv(env);
}

// Singleton configuration instance
let _config: ProjectFactoryConfig | null = null;

/**
 * Get configuration singleton
 */
export function getConfig(): ProjectFactoryConfig {
  if (_config === null) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  _config = null;
}

// Export default config for direct access
export const config = getConfig();