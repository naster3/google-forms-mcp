import { AppError, mapGoogleApiError } from "./errors.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error: AppError): boolean {
  return error.code === "rate_limited" || error.code === "google_api_error";
}

export async function withGoogleRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let currentAttempt = 0;
  let lastError: AppError | null = null;

  while (currentAttempt < attempts) {
    try {
      return await operation();
    } catch (error) {
      const mapped = mapGoogleApiError(error);
      lastError = mapped;
      currentAttempt += 1;

      if (!shouldRetry(mapped) || currentAttempt >= attempts) {
        throw mapped;
      }

      await delay(250 * currentAttempt);
    }
  }

  throw lastError ?? new AppError("retry_failed", "Google API operation failed after retries.");
}
