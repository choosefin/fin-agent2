import { authService } from '../services/auth.service';
import { z } from 'zod';

export interface AuthContext {
  userId: string;
  email?: string;
  role?: string;
  sessionId?: string;
  apiKeyId?: string;
}

export interface AuthenticatedRequest {
  auth: AuthContext;
  body: any;
  headers: Record<string, string>;
  query?: Record<string, string>;
}

/**
 * Authentication middleware for Motia steps
 */
export async function authenticate(
  req: any,
  logger: any
): Promise<AuthContext> {
  const authHeader = req.headers?.authorization;
  const apiKey = req.headers?.['x-api-key'];
  const sessionId = req.headers?.['x-session-id'];

  // Check for Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const user = await authService.verifyToken(token);
      
      logger.info('User authenticated via JWT', { userId: user.userId });
      
      return {
        userId: user.userId,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      logger.error('JWT authentication failed', { error: error.message });
      throw new Error('Invalid authentication token');
    }
  }

  // Check for API key
  if (apiKey) {
    try {
      const keyData = await authService.validateApiKey(apiKey);
      
      if (!keyData) {
        throw new Error('Invalid API key');
      }

      logger.info('User authenticated via API key', { 
        userId: keyData.user_id,
        keyName: keyData.name 
      });

      return {
        userId: keyData.user_id,
        apiKeyId: keyData.id,
      };
    } catch (error) {
      logger.error('API key authentication failed', { error: error.message });
      throw new Error('Invalid API key');
    }
  }

  // Check for session ID
  if (sessionId) {
    try {
      const session = await authService.validateSession(sessionId);
      
      if (!session) {
        throw new Error('Invalid or expired session');
      }

      logger.info('User authenticated via session', { 
        userId: session.user_id,
        sessionId 
      });

      return {
        userId: session.user_id,
        sessionId,
      };
    } catch (error) {
      logger.error('Session authentication failed', { error: error.message });
      throw new Error('Invalid session');
    }
  }

  throw new Error('No authentication credentials provided');
}

/**
 * Authorization middleware - check user permissions
 */
export async function authorize(
  auth: AuthContext,
  resource: string,
  action: string,
  logger: any
): Promise<boolean> {
  try {
    const hasPermission = await authService.checkUserPermission(
      auth.userId,
      resource,
      action
    );

    if (!hasPermission) {
      logger.warn('Authorization failed', {
        userId: auth.userId,
        resource,
        action,
      });
      return false;
    }

    logger.info('Authorization successful', {
      userId: auth.userId,
      resource,
      action,
    });

    return true;
  } catch (error) {
    logger.error('Authorization check failed', { error: error.message });
    return false;
  }
}

/**
 * Validate user context for sensitive operations
 */
export async function validateUserContext(
  auth: AuthContext,
  requiredRole?: string,
  requiredScopes?: string[]
): Promise<boolean> {
  // Check role if required
  if (requiredRole && auth.role !== requiredRole) {
    return false;
  }

  // Check API key scopes if using API key auth
  if (auth.apiKeyId && requiredScopes?.length) {
    // This would need to be implemented based on your scope storage
    // For now, we'll assume API keys have limited scopes
    return false;
  }

  // Additional context validation can be added here
  return true;
}

/**
 * Rate limiting helper
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  userId: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || userLimit.resetTime < now) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (userLimit.count >= limit) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Input sanitization helper
 */
export function sanitizeInput<T>(input: T, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Input validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Create authenticated handler wrapper
 */
export function withAuth<T extends AuthenticatedRequest>(
  handler: (req: T, context: any) => Promise<any>,
  options?: {
    requiredRole?: string;
    requiredScopes?: string[];
    rateLimit?: { limit: number; windowMs: number };
    resource?: string;
    action?: string;
  }
) {
  return async (req: any, context: any) => {
    const { logger } = context;

    try {
      // Authenticate user
      const auth = await authenticate(req, logger);

      // Check rate limit
      if (options?.rateLimit) {
        const { limit, windowMs } = options.rateLimit;
        if (!checkRateLimit(auth.userId, limit, windowMs)) {
          return {
            status: 429,
            body: { error: 'Rate limit exceeded' },
          };
        }
      }

      // Validate user context
      if (options?.requiredRole || options?.requiredScopes) {
        const isValid = await validateUserContext(
          auth,
          options.requiredRole,
          options.requiredScopes
        );

        if (!isValid) {
          return {
            status: 403,
            body: { error: 'Insufficient permissions' },
          };
        }
      }

      // Check authorization for specific resource
      if (options?.resource && options?.action) {
        const isAuthorized = await authorize(
          auth,
          options.resource,
          options.action,
          logger
        );

        if (!isAuthorized) {
          return {
            status: 403,
            body: { error: 'Access denied' },
          };
        }
      }

      // Add auth context to request
      const authenticatedReq = {
        ...req,
        auth,
      } as T;

      // Call the actual handler
      return await handler(authenticatedReq, context);
    } catch (error) {
      logger.error('Authentication/Authorization failed', { error: error.message });
      
      return {
        status: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
  };
}