/**
 * Application error model shared by services, server actions and the HTTP API.
 * Messages are safe to show to end users; internal details never are.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LIMIT_EXCEEDED"
  | "INVALID_STATE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  LIMIT_EXCEEDED: 402,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, opts?: { fieldErrors?: FieldErrors; details?: Record<string, unknown> }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = opts?.fieldErrors;
    this.details = opts?.details;
  }

  get status() {
    return ERROR_STATUS[this.code];
  }
}

export const errors = {
  validation: (message: string, fieldErrors?: FieldErrors) => new AppError("VALIDATION_ERROR", message, { fieldErrors }),
  unauthenticated: (message = "Please sign in to continue.") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to do that.") => new AppError("FORBIDDEN", message),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`),
  conflict: (message: string) => new AppError("CONFLICT", message),
  invalidState: (message: string) => new AppError("INVALID_STATE", message),
  limit: (message: string, details?: Record<string, unknown>) => new AppError("LIMIT_EXCEEDED", message, { details }),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", {
      details: { retryAfterSeconds },
    }),
};

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Postgres unique-violation detection (postgres-js error shape). */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = (e as { cause?: unknown })?.cause ?? e;
  const pg = err as { code?: string; constraint_name?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint_name === constraint);
}

export function isCheckViolation(e: unknown): boolean {
  const err = (e as { cause?: unknown })?.cause ?? e;
  return (err as { code?: string })?.code === "23514";
}
