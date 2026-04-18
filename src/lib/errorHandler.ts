/**
 * Error handling utilities for secure error responses
 * Sanitizes error messages to prevent information leakage
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Sanitize error for client response
 * Never send internal error details to the client in production
 */
export function sanitizeErrorForClient(error: unknown): { message: string; statusCode: number } {
  // Production: return generic error message
  if (process.env.NODE_ENV === "production") {
    if (error instanceof AppError) {
      return {
        message: error.message,
        statusCode: error.statusCode,
      };
    }
    return {
      message: "An error occurred. Please try again later.",
      statusCode: 500,
    };
  }

  // Development: return detailed error message for debugging
  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    message: String(error),
    statusCode: 500,
  };
}

/**
 * Log error details securely
 * Only logs detailed information server-side
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    // In production, could send to external logging service (Sentry, etc.)
    console.error("[ERROR]", {
      message: error instanceof Error ? error.message : String(error),
      context,
      timestamp: new Date().toISOString(),
    });
  } else {
    // In development, log full error details
    console.error("[ERROR]", error, context);
  }
}
