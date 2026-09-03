const MAX_ATTEMPTS = 3;

type Sleep = (milliseconds: number) => Promise<void>;

export async function retryOpenRouter<T>(
  request: () => Promise<T>,
  sleep: Sleep = wait
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (!isRetryableError(error) || attempt === MAX_ATTEMPTS) throw error;

      const delay = retryDelay(error, attempt);
      console.info(
        `[DealScout] OpenRouter request failed transiently; retrying in ${delay}ms (attempt ${
          attempt + 1
        }/${MAX_ATTEMPTS}).`
      );
      await sleep(delay);
    }
  }

  throw new Error("OpenRouter retry attempts exhausted");
}

function isRetryableError(error: unknown): boolean {
  return isRateLimitError(error) || isCanceledError(error);
}

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    isRecord(error.response) &&
    error.response.status === 429
  );
}

function isCanceledError(error: unknown): boolean {
  return error instanceof Error && /^canceled$/i.test(error.message.trim());
}

function retryDelay(error: unknown, attempt: number): number {
  const retryAfter = retryAfterMilliseconds(error);
  return retryAfter ?? attempt * 1_000;
}

function retryAfterMilliseconds(error: unknown): number | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("response" in error) ||
    !isRecord(error.response) ||
    !isRecord(error.response.headers)
  )
    return undefined;

  const value = error.response.headers["retry-after"];
  const seconds = typeof value === "string" ? Number(value) : value;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1_000
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
