import { authService } from '../services/auth.service';
import { encryptionService } from '../services/encryption.service';
import { secretsService } from '../services/secrets.service';
import { corsService, withCors } from '../services/cors.service';
import { withAuth } from '../middleware/auth.middleware';

/**
 * Comprehensive security configuration for the application
 */
export const securityConfig = {
  // Authentication settings
  auth: {
    jwtExpiry: '24h',
    sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours in ms
    apiKeyExpiry: 90 * 24 * 60 * 60 * 1000, // 90 days in ms
    requireAuth: process.env.NODE_ENV === 'production',
    allowedAuthMethods: ['jwt', 'apiKey', 'session'],
  },

  // Rate limiting settings
  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 1000, // limit each IP to 1000 requests per windowMs
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      limit: 100, // limit each user to 100 API requests per minute
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 5, // limit login attempts to 5 per 15 minutes
    },
    plaid: {
      windowMs: 60 * 1000, // 1 minute
      limit: 20, // limit Plaid operations to 20 per minute
    },
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'scrypt',
    iterations: 32768,
    saltLength: 32,
    ivLength: 16,
  },

  // Input validation settings
  validation: {
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxObjectDepth: 10,
    sanitizeHtml: true,
    stripUnknownProperties: true,
  },

  // CORS settings (delegated to corsService)
  cors: corsService.getConfig(),

  // Security headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },

  // Audit logging settings
  audit: {
    enabled: true,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
      'privateKey',
      'creditCard',
      'ssn',
    ],
  },

  // Secret rotation settings
  secretRotation: {
    enabled: process.env.NODE_ENV === 'production',
    intervalDays: 90,
    notifyBeforeDays: 7,
  },
};

/**
 * Initialize security services
 */
export async function initializeSecurity() {
  console.log('Initializing security services...');

  try {
    // Initialize required secrets
    await secretsService.initializeRequiredSecrets();

    // Set up CORS for production
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (allowedOrigins.length > 0) {
        corsService.updateConfig({ origin: allowedOrigins });
      }
    }

    console.log('Security services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize security services:', error);
    throw error;
  }
}

/**
 * Create a secure handler with all security middleware
 */
export function createSecureHandler(
  handler: any,
  options?: {
    requireAuth?: boolean;
    requiredRole?: string;
    requiredScopes?: string[];
    rateLimit?: { limit: number; windowMs: number };
    resource?: string;
    action?: string;
    cors?: boolean;
  }
) {
  let secureHandler = handler;

  // Apply CORS if needed
  if (options?.cors !== false) {
    secureHandler = withCors(secureHandler);
  }

  // Apply authentication if needed
  if (options?.requireAuth !== false && securityConfig.auth.requireAuth) {
    secureHandler = withAuth(secureHandler, {
      requiredRole: options?.requiredRole,
      requiredScopes: options?.requiredScopes,
      rateLimit: options?.rateLimit || securityConfig.rateLimit.api,
      resource: options?.resource,
      action: options?.action,
    });
  }

  return secureHandler;
}

/**
 * Security utilities
 */
export const securityUtils = {
  // Mask sensitive data in logs
  maskSensitiveData(data: any): any {
    if (!data) return data;

    const masked = { ...data };
    securityConfig.audit.sensitiveFields.forEach(field => {
      if (masked[field]) {
        masked[field] = '***REDACTED***';
      }
    });

    return masked;
  },

  // Validate API key format
  isValidApiKeyFormat(apiKey: string): boolean {
    return /^sk_[a-f0-9]{64}$/.test(apiKey);
  },

  // Generate secure random string
  generateSecureString(length: number = 32): string {
    return encryptionService.generateSecureToken(length);
  },

  // Check if request is from trusted source
  isTrustedSource(ip: string): boolean {
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    return trustedIPs.includes(ip);
  },
};

// Export services for direct use
export {
  authService,
  encryptionService,
  secretsService,
  corsService,
};

// Initialize security on module load
if (process.env.NODE_ENV !== 'test') {
  initializeSecurity().catch(console.error);
}