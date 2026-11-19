export interface FetchWithRetryOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const fetchImpl = options.fetchFn || fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxRetries) {
        return response;
      }

      const retryAfterHeader = response.headers?.get?.('retry-after');
      const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const delay =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 5
          ? retryAfterSec * 1000
          : baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === maxRetries) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('HTTP request failed after retries.');
}
