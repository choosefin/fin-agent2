import { z } from 'zod';

// CORS configuration schema
const corsConfigSchema = z.object({
  origin: z.union([
    z.string(),
    z.boolean(),
    z.array(z.string()),
    z.instanceof(RegExp),
    z.array(z.instanceof(RegExp)),
  ]),
  methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])),
  allowedHeaders: z.array(z.string()),
  exposedHeaders: z.array(z.string()).optional(),
  credentials: z.boolean(),
  maxAge: z.number().optional(),
  preflightContinue: z.boolean().optional(),
  optionsSuccessStatus: z.number().optional(),
});

export type CorsConfig = z.infer<typeof corsConfigSchema>;

export class CorsService {
  private config: CorsConfig;

  constructor() {
    this.config = this.getEnvironmentConfig();
  }

  /**
   * Get CORS configuration based on environment
   */
  private getEnvironmentConfig(): CorsConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (isProduction) {
      // Production configuration - strict
      return {
        origin: allowedOrigins.length > 0 ? allowedOrigins : [
          'https://app.example.com',
          'https://www.example.com',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'X-Session-ID',
          'X-API-Key',
        ],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
        credentials: true,
        maxAge: 86400, // 24 hours
        optionsSuccessStatus: 204,
      };
    } else {
      // Development configuration - more permissive
      return {
        origin: true, // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'X-Session-ID',
          'X-API-Key',
          'X-Debug-Mode',
        ],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Debug-Info'],
        credentials: true,
        maxAge: 3600, // 1 hour
        optionsSuccessStatus: 204,
      };
    }
  }

  /**
   * Apply CORS headers to response
   */
  applyCorsHeaders(
    request: { headers: Record<string, string> },
    response: { headers?: Record<string, string> }
  ): Record<string, string> {
    const origin = request.headers.origin || request.headers.Origin;
    const headers = response.headers || {};

    // Check if origin is allowed
    if (this.isOriginAllowed(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Add other CORS headers for preflight requests
    if (request.headers['access-control-request-method']) {
      headers['Access-Control-Allow-Methods'] = this.config.methods.join(', ');
      headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');
      
      if (this.config.maxAge) {
        headers['Access-Control-Max-Age'] = this.config.maxAge.toString();
      }
    }

    // Add exposed headers
    if (this.config.exposedHeaders && this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    return headers;
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false;

    const { origin: configOrigin } = this.config;

    if (typeof configOrigin === 'boolean') {
      return configOrigin;
    }

    if (typeof configOrigin === 'string') {
      return configOrigin === origin;
    }

    if (Array.isArray(configOrigin)) {
      // Check if any element is a RegExp or string
      return configOrigin.some(allowed => {
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return allowed === origin;
      });
    }

    if (configOrigin instanceof RegExp) {
      return configOrigin.test(origin);
    }

    return false;
  }

  /**
   * Handle preflight OPTIONS request
   */
  handlePreflight(request: { headers: Record<string, string> }) {
    const headers = this.applyCorsHeaders(request, {});

    return {
      status: this.config.optionsSuccessStatus || 204,
      headers,
      body: '',
    };
  }

  /**
   * Validate request origin
   */
  validateOrigin(origin: string | undefined): boolean {
    // Always validate origin, even in development
    if (!origin) {
      // Allow requests without origin header (e.g., same-origin, Postman)
      return process.env.NODE_ENV !== 'production';
    }

    // In development, check against allowed development origins
    if (process.env.NODE_ENV !== 'production') {
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://0.0.0.0:3000',
        'http://0.0.0.0:3001',
        'http://0.0.0.0:5173',
      ];
      
      // Also check if it matches a localhost pattern with any port
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d{1,5}$/;
      return devOrigins.includes(origin) || localhostPattern.test(origin);
    }

    return this.isOriginAllowed(origin);
  }

  /**
   * Get current CORS configuration
   */
  getConfig(): CorsConfig {
    return { ...this.config };
  }

  /**
   * Update CORS configuration (for runtime updates)
   */
  updateConfig(updates: Partial<CorsConfig>) {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin: string) {
    if (Array.isArray(this.config.origin)) {
      const origins = this.config.origin as Array<string | RegExp>;
      const found = origins.some(o => {
        if (typeof o === 'string') return o === origin;
        return false;
      });
      if (!found) {
        (this.config.origin as Array<string | RegExp>).push(origin);
      }
    } else if (typeof this.config.origin === 'string') {
      this.config.origin = [this.config.origin, origin];
    }
  }

  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin: string) {
    if (Array.isArray(this.config.origin)) {
      this.config.origin = (this.config.origin as Array<string | RegExp>).filter(o => {
        if (typeof o === 'string') return o !== origin;
        return true; // Keep RegExp patterns
      });
    }
  }
}

export const corsService = new CorsService();

/**
 * CORS middleware wrapper for Motia handlers
 */
export function withCors<T extends { headers: Record<string, string> }>(
  handler: (req: T, context: any) => Promise<any>
) {
  return async (req: T, context: any) => {
    const { logger } = context;

    // Handle preflight requests
    if (req.headers['access-control-request-method']) {
      logger.info('Handling CORS preflight request');
      return corsService.handlePreflight(req);
    }

    // Validate origin
    const origin = req.headers.origin || req.headers.Origin;
    if (!corsService.validateOrigin(origin)) {
      logger.warn('CORS validation failed', { origin });
      return {
        status: 403,
        body: { error: 'Origin not allowed' },
      };
    }

    // Execute handler
    const response = await handler(req, context);

    // Apply CORS headers to response
    response.headers = corsService.applyCorsHeaders(req, response);

    return response;
  };
}