import { z } from 'zod';

/**
 * Error sanitization and handling service
 */

export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Resource errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}

export interface SanitizedError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  requestId?: string;
  details?: Record<string, any>;
  retryAfter?: number;
}

export class ErrorService {
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';
  private readonly sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /credential/i,
    /auth/i,
    /api[-_]?key/i,
    /access[-_]?token/i,
    /refresh[-_]?token/i,
    /private/i,
    /ssn/i,
    /credit[-_]?card/i,
  ];

  /**
   * Sanitize an error for client response
   */
  sanitizeError(
    error: any,
    options: {
      statusCode?: number;
      path?: string;
      requestId?: string;
      includeStack?: boolean;
    } = {}
  ): SanitizedError {
    // Determine error code and status
    const errorCode = this.determineErrorCode(error);
    const statusCode = options.statusCode || this.determineStatusCode(errorCode);
    
    // Create base sanitized error
    const sanitized: SanitizedError = {
      code: errorCode,
      message: this.sanitizeMessage(error.message || 'An error occurred'),
      statusCode,
      timestamp: new Date().toISOString(),
      path: options.path,
      requestId: options.requestId,
    };

    // Add safe details in development
    if (this.isDevelopment && options.includeStack !== false) {
      sanitized.details = {
        stack: this.sanitizeStack(error.stack),
        originalMessage: error.message,
      };
    }

    // Add retry information for rate limiting
    if (errorCode === ErrorCode.RATE_LIMIT_EXCEEDED && error.retryAfter) {
      sanitized.retryAfter = error.retryAfter;
    }

    // Add validation errors if present
    if (error instanceof z.ZodError) {
      sanitized.details = {
        validationErrors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      };
    }

    return sanitized;
  }

  /**
   * Determine error code from error object
   */
  private determineErrorCode(error: any): ErrorCode {
    // Check for specific error types
    if (error instanceof z.ZodError) {
      return ErrorCode.VALIDATION_ERROR;
    }

    // Check error message patterns
    const message = (error.message || '').toLowerCase();
    
    if (message.includes('unauthorized') || message.includes('not authenticated')) {
      return ErrorCode.UNAUTHORIZED;
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorCode.FORBIDDEN;
    }
    if (message.includes('not found')) {
      return ErrorCode.NOT_FOUND;
    }
    if (message.includes('duplicate') || message.includes('already exists')) {
      return ErrorCode.DUPLICATE_RESOURCE;
    }
    if (message.includes('rate limit')) {
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCode.VALIDATION_ERROR;
    }
    if (message.includes('database') || message.includes('connection')) {
      return ErrorCode.DATABASE_ERROR;
    }

    // Check for error codes
    if (error.code) {
      switch (error.code) {
        case 'UNAUTHORIZED':
        case '401':
          return ErrorCode.UNAUTHORIZED;
        case 'FORBIDDEN':
        case '403':
          return ErrorCode.FORBIDDEN;
        case 'NOT_FOUND':
        case '404':
          return ErrorCode.NOT_FOUND;
        case 'CONFLICT':
        case '409':
          return ErrorCode.CONFLICT;
        case 'RATE_LIMITED':
        case '429':
          return ErrorCode.RATE_LIMIT_EXCEEDED;
        case 'SERVICE_UNAVAILABLE':
        case '503':
          return ErrorCode.SERVICE_UNAVAILABLE;
      }
    }

    // Default to internal error
    return ErrorCode.INTERNAL_ERROR;
  }

  /**
   * Determine HTTP status code from error code
   */
  private determineStatusCode(errorCode: ErrorCode): number {
    switch (errorCode) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.INVALID_TOKEN:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.INVALID_CREDENTIALS:
        return 401;
      
      case ErrorCode.FORBIDDEN:
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
      case ErrorCode.ACCOUNT_LOCKED:
        return 403;
      
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.MISSING_REQUIRED_FIELD:
        return 400;
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      
      case ErrorCode.NOT_FOUND:
      case ErrorCode.RESOURCE_NOT_FOUND:
        return 404;
      
      case ErrorCode.CONFLICT:
      case ErrorCode.DUPLICATE_RESOURCE:
        return 409;
      
      case ErrorCode.SERVICE_UNAVAILABLE:
      case ErrorCode.MAINTENANCE_MODE:
        return 503;
      
      case ErrorCode.INTERNAL_ERROR:
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
      default:
        return 500;
    }
  }

  /**
   * Sanitize error message to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message;

    // Remove sensitive patterns
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(sanitized)) {
        // Replace sensitive parts with generic message
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      }
    }

    // Remove file paths in production
    if (!this.isDevelopment) {
      sanitized = sanitized
        .replace(/\/[\w\-\/\.]+\.(ts|js|json)/g, '[FILE]')
        .replace(/at\s+.*\s+\(.*\)/g, '')
        .replace(/\n\s*at\s+.*/g, '');
    }

    // Remove database table/column names in production
    if (!this.isDevelopment) {
      sanitized = sanitized
        .replace(/relation "[\w_]+" does not exist/g, 'Resource does not exist')
        .replace(/column "[\w_]+" of relation "[\w_]+"/g, 'Invalid field')
        .replace(/duplicate key value violates unique constraint "[\w_]+"/g, 'Duplicate value');
    }

    // Limit message length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    return sanitized;
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStack(stack?: string): string {
    if (!stack) return '';

    let sanitized = stack;

    // Remove absolute file paths
    sanitized = sanitized.replace(/\/[\w\-\/\.]+\//g, './');

    // Remove sensitive information from stack
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), '[REDACTED]');
    }

    // Limit stack trace lines
    const lines = sanitized.split('\n');
    if (lines.length > 10) {
      sanitized = lines.slice(0, 10).join('\n') + '\n... (truncated)';
    }

    return sanitized;
  }

  /**
   * Create a standardized error response
   */
  createErrorResponse(
    error: any,
    options: {
      statusCode?: number;
      path?: string;
      requestId?: string;
    } = {}
  ) {
    const sanitized = this.sanitizeError(error, options);

    return {
      status: sanitized.statusCode,
      headers: this.getErrorHeaders(sanitized),
      body: {
        error: {
          code: sanitized.code,
          message: sanitized.message,
          timestamp: sanitized.timestamp,
          path: sanitized.path,
          requestId: sanitized.requestId,
          ...(sanitized.details && { details: sanitized.details }),
        },
      },
    };
  }

  /**
   * Get appropriate headers for error response
   */
  private getErrorHeaders(error: SanitizedError): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Error-Code': error.code,
    };

    if (error.retryAfter) {
      headers['Retry-After'] = error.retryAfter.toString();
    }

    if (error.requestId) {
      headers['X-Request-ID'] = error.requestId;
    }

    return headers;
  }

  /**
   * Log error with appropriate level
   */
  logError(
    error: any,
    context: {
      userId?: string;
      path?: string;
      method?: string;
      ip?: string;
      userAgent?: string;
    } = {}
  ) {
    const errorCode = this.determineErrorCode(error);
    const statusCode = this.determineStatusCode(errorCode);

    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : 
                    statusCode >= 400 ? 'warn' : 'info';

    const logData = {
      errorCode,
      statusCode,
      message: error.message,
      ...context,
      ...(this.isDevelopment && { stack: error.stack }),
    };

    // Log based on level
    switch (logLevel) {
      case 'error':
        console.error('Server error:', logData);
        break;
      case 'warn':
        console.warn('Client error:', logData);
        break;
      default:
        console.info('Error:', logData);
    }

    // In production, send to monitoring service
    if (!this.isDevelopment && statusCode >= 500) {
      this.sendToMonitoring(error, context);
    }
  }

  /**
   * Send error to monitoring service (e.g., Sentry, DataDog)
   */
  private sendToMonitoring(error: any, context: any) {
    // Implementation would depend on monitoring service
    // Example: Sentry.captureException(error, { extra: context });
  }

  /**
   * Create custom application error
   */
  createError(
    code: ErrorCode,
    message: string,
    details?: any
  ): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.details = details;
    return error;
  }
}

// Singleton instance
export const errorService = new ErrorService();

/**
 * Error handler middleware wrapper
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const [req, context] = args;
      const { logger } = context || {};

      // Log the error
      errorService.logError(error, {
        path: req?.path || req?.url,
        method: req?.method,
        userId: req?.auth?.userId,
      });

      // Return sanitized error response
      return errorService.createErrorResponse(error, {
        path: req?.path || req?.url,
        requestId: context?.traceId,
      });
    }
  }) as T;
}