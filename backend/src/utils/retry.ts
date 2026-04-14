import { createLogger } from './logger.js';

const logger = createLogger('Retry');

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const defaultRetryOptions: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error | undefined;
  let currentDelay = opts.delayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxAttempts) {
        logger.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms`, {
          error: lastError.message,
        });

        if (opts.onRetry) {
          opts.onRetry(attempt, lastError);
        }

        await sleep(currentDelay);
        currentDelay = Math.min(
          currentDelay * (opts.backoffMultiplier ?? 2),
          opts.maxDelayMs ?? 30000
        );
      }
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay calculator
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number = 30000,
  multiplier: number = 2
): number {
  const delay = baseDelayMs * Math.pow(multiplier, attempt - 1);
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelayMs);
}