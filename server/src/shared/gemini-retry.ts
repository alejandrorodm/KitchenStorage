/** HTTP statuses Gemini returns when it is overloaded or briefly down; worth trying again. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

export function isTransientAiError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status);
}

export interface RetryPlan {
  /** Models to try in order: the configured one first, then the fallbacks. */
  models: string[];
  /** Attempts per model. */
  attempts: number;
  /** Wait before the n-th retry on the same model (n starts at 1). */
  delayMs: (retry: number) => number;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `call` with each model in turn, retrying overload errors with a growing
 * wait. Any other error fails at once; when every attempt is overloaded, the
 * last error is thrown.
 */
export async function withAiRetry<T>(plan: RetryPlan, call: (model: string) => Promise<T>): Promise<T> {
  const sleep = plan.sleep ?? wait;
  let lastError: unknown;
  for (const model of plan.models) {
    for (let attempt = 1; attempt <= plan.attempts; attempt++) {
      if (attempt > 1) await sleep(plan.delayMs(attempt - 1));
      try {
        return await call(model);
      } catch (error) {
        if (!isTransientAiError(error)) throw error;
        lastError = error;
      }
    }
  }
  throw lastError;
}

/** Construction options shared by the Gemini adapters. */
export interface GeminiOptions {
  /** Model to use when the configured one stays overloaded. */
  fallbackModel?: string;
  sleep?: (ms: number) => Promise<void>;
}

/** The configured model first, then the fallback when it is a different one. */
export function geminiRetryPlan(model: string, fallbackModel: string | undefined): RetryPlan {
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
  return { models, attempts: 3, delayMs: (retry) => 1000 * 2 ** (retry - 1) };
}
