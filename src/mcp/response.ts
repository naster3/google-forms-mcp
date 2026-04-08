import type { AppError } from "../google/errors.js";

export type ToolSuccess<T> = {
  ok: true;
  data: T;
};

export type ToolFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function successResult<T>(data: T): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ToolSuccess<T>;
} {
  const payload: ToolSuccess<T> = {
    ok: true,
    data,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function errorResult(error: AppError): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ToolFailure;
  isError: true;
} {
  const payload: ToolFailure = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}
