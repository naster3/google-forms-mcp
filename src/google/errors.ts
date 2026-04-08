type GoogleApiErrorLike = Error & {
  code?: number;
  status?: number | string;
  errors?: Array<{ reason?: string; message?: string }>;
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: number;
        status?: string;
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
  };
};

export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function mapGoogleApiError(error: unknown): AppError {
  const candidate = error as GoogleApiErrorLike;
  const httpStatus = candidate.response?.status ?? candidate.code;
  const apiStatus = candidate.response?.data?.error?.status ?? candidate.status;
  const reasons = candidate.response?.data?.error?.errors ?? candidate.errors ?? [];
  const primaryReason = reasons[0]?.reason;
  const message =
    candidate.response?.data?.error?.message ?? candidate.message ?? "Unknown Google API error.";

  if (httpStatus === 401 || apiStatus === "UNAUTHENTICATED") {
    return new AppError("token_expired", "Google OAuth token is missing, expired, or invalid.", {
      httpStatus,
      apiStatus,
      primaryReason,
    });
  }

  if (httpStatus === 403 || apiStatus === "PERMISSION_DENIED") {
    return new AppError("insufficient_permissions", "Google denied access to this form or file.", {
      httpStatus,
      apiStatus,
      primaryReason,
    });
  }

  if (httpStatus === 404 || apiStatus === "NOT_FOUND") {
    return new AppError("form_not_found", "Google Form was not found.", {
      httpStatus,
      apiStatus,
      primaryReason,
    });
  }

  if (httpStatus === 429 || apiStatus === "RESOURCE_EXHAUSTED") {
    return new AppError("rate_limited", "Google API rate limit exceeded.", {
      httpStatus,
      apiStatus,
      primaryReason,
    });
  }

  if (httpStatus === 400 || apiStatus === "INVALID_ARGUMENT") {
    return new AppError("invalid_request", message, {
      httpStatus,
      apiStatus,
      primaryReason,
    });
  }

  return new AppError("google_api_error", message, {
    httpStatus,
    apiStatus,
    primaryReason,
  });
}
