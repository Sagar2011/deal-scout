const OPENROUTER_TIMEOUT_MS = 60_000;

export async function withOpenRouterTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = OPENROUTER_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
