import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('LLMClient');

/**
 * LLM Client configuration
 */
export interface LLMClientConfig {
  /** Model name */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Base URL for API */
  baseUrl?: string;
}

/**
 * Create an LLM client with the given configuration
 * Uses the global config by default but can be overridden
 */
export function createLLMClient(override?: Partial<LLMClientConfig>): ChatOpenAI {
  const llmConfig = {
    modelName: override?.model ?? config.llm.model,
    temperature: override?.temperature ?? config.llm.temperature,
    maxTokens: override?.maxTokens ?? config.llm.maxTokens,
    baseUrl: override?.baseUrl ?? config.llm.baseUrl,
    apiKey: config.llm.apiKey || undefined, // Use undefined for Ollama
    timeout: override?.timeout ?? config.llm.timeout,
  };

  logger.debug('Creating LLM client', {
    model: llmConfig.modelName,
    baseUrl: llmConfig.baseUrl,
  });

  return new ChatOpenAI(llmConfig);
}

/**
 * Get the default LLM client singleton
 */
let defaultClient: ChatOpenAI | null = null;

export function getDefaultLLMClient(): ChatOpenAI {
  if (!defaultClient) {
    defaultClient = createLLMClient();
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing or config changes)
 */
export function resetDefaultLLMClient(): void {
  defaultClient = null;
}

/**
 * LLM Client factory for creating agents
 */
export const llmClientFactory = {
  /**
   * Create a client for idea generation
   */
  forIdeaGeneration(): ChatOpenAI {
    return createLLMClient({
      temperature: 0.7,
      maxTokens: 4096,
    });
  },

  /**
   * Create a client for architecture design
   */
  forArchitecture(): ChatOpenAI {
    return createLLMClient({
      temperature: 0.3, // Lower temperature for more deterministic output
      maxTokens: 4096,
    });
  },

  /**
   * Create a client for code generation
   */
  forCodeGeneration(): ChatOpenAI {
    return createLLMClient({
      temperature: 0.4,
      maxTokens: 8192,
    });
  },

  /**
   * Create a client for testing/review
   */
  forReview(): ChatOpenAI {
    return createLLMClient({
      temperature: 0.2,
      maxTokens: 4096,
    });
  },
};
