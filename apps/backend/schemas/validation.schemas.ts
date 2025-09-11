import { z } from 'zod';

/**
 * Common validation schemas and utilities
 */

// String validators with security constraints
export const safeString = (maxLength: number = 255) => 
  z.string()
    .min(1, 'Field cannot be empty')
    .max(maxLength, `Field must be ${maxLength} characters or less`)
    .regex(/^[^<>'"`;()]*$/, 'Field contains invalid characters');

export const safeEmail = () =>
  z.string()
    .email('Invalid email format')
    .max(320, 'Email too long')
    .toLowerCase()
    .transform(val => val.trim());

export const safeUrl = () =>
  z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(url => {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    }, 'Only HTTP/HTTPS URLs are allowed');

export const safeUsername = () =>
  z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const safePassword = () =>
  z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Number validators
export const safeInt = (min?: number, max?: number) => {
  let schema = z.number().int('Must be an integer');
  if (min !== undefined) schema = schema.min(min, `Must be at least ${min}`);
  if (max !== undefined) schema = schema.max(max, `Must be at most ${max}`);
  return schema;
};

export const safeFloat = (min?: number, max?: number) => {
  let schema = z.number();
  if (min !== undefined) schema = schema.min(min, `Must be at least ${min}`);
  if (max !== undefined) schema = schema.max(max, `Must be at most ${max}`);
  return schema;
};

export const positiveInt = () => safeInt(1);
export const nonNegativeInt = () => safeInt(0);

// ID validators
export const uuidSchema = () =>
  z.string()
    .uuid('Invalid UUID format')
    .toLowerCase();

export const objectIdSchema = () =>
  z.string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

// Date validators
export const safeDateString = () =>
  z.string()
    .datetime('Invalid datetime format')
    .refine(date => {
      const parsed = new Date(date);
      const now = new Date();
      const hundredYearsAgo = new Date();
      hundredYearsAgo.setFullYear(now.getFullYear() - 100);
      const tenYearsFromNow = new Date();
      tenYearsFromNow.setFullYear(now.getFullYear() + 10);
      
      return parsed > hundredYearsAgo && parsed < tenYearsFromNow;
    }, 'Date is out of reasonable range');

// Financial validators
export const currencyAmount = () =>
  z.number()
    .min(0.01, 'Amount must be at least 0.01')
    .max(999999999.99, 'Amount too large')
    .transform(val => Math.round(val * 100) / 100); // Round to 2 decimal places

export const currencyCode = () =>
  z.string()
    .length(3, 'Currency code must be 3 characters')
    .regex(/^[A-Z]{3}$/, 'Invalid currency code format')
    .transform(val => val.toUpperCase());

// API-specific schemas
export const paginationSchema = z.object({
  page: positiveInt().default(1),
  limit: safeInt(1, 100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const searchQuerySchema = z.object({
  q: safeString(200).optional(),
  filters: z.record(z.string(), z.any()).optional(),
  ...paginationSchema.shape,
});

// Plaid-specific schemas
export const plaidPublicTokenSchema = z.object({
  publicToken: z.string()
    .min(1)
    .max(500)
    .regex(/^public-[a-zA-Z0-9-]+$/, 'Invalid Plaid public token format'),
  userId: uuidSchema(),
  institution: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  accounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    subtype: z.string().optional(),
  })).optional(),
});

export const plaidAccountIdSchema = z.string()
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid account ID format');

// Pet store schemas (example domain)
export const petSchema = z.object({
  name: safeString(100),
  photoUrl: safeUrl(),
  breed: safeString(50).optional(),
  age: safeInt(0, 30).optional(),
  userId: uuidSchema().optional(),
});

export const foodOrderSchema = z.object({
  id: safeString(100),
  quantity: safeInt(1, 100),
  productName: safeString(200).optional(),
  price: currencyAmount().optional(),
});

// User management schemas
export const createUserSchema = z.object({
  email: safeEmail(),
  password: safePassword(),
  username: safeUsername().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateUserSchema = z.object({
  email: safeEmail().optional(),
  username: safeUsername().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Authentication schemas
export const loginSchema = z.object({
  email: safeEmail(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const apiKeyCreateSchema = z.object({
  name: safeString(100),
  scopes: z.array(z.string()).max(20).default([]),
  expiresInDays: safeInt(1, 365).optional(),
});

// Market data schemas
export const stockSymbolSchema = z.string()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9.-]+$/, 'Invalid stock symbol format')
  .transform(val => val.toUpperCase());

export const marketDataRequestSchema = z.object({
  symbols: z.array(stockSymbolSchema).min(1).max(100),
  startDate: safeDateString().optional(),
  endDate: safeDateString().optional(),
  interval: z.enum(['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1mo']).optional(),
});

// Transaction schemas
export const transactionSchema = z.object({
  amount: currencyAmount(),
  currency: currencyCode(),
  description: safeString(500),
  category: safeString(100).optional(),
  date: safeDateString(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Sanitization utilities
export const sanitizeHtml = (input: string): string => {
  // Remove all HTML tags and entities
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, '') // Remove HTML entities
    .trim();
};

export const sanitizeJson = <T>(input: unknown, schema: z.ZodSchema<T>): T => {
  // Parse and validate JSON input
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${issues}`);
    }
    throw error;
  }
};

// SQL injection prevention
export const sanitizeSqlIdentifier = (identifier: string): string => {
  // Only allow alphanumeric characters and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return identifier;
};

// Path traversal prevention
export const sanitizePath = (path: string): string => {
  // Remove any path traversal attempts
  const sanitized = path
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/\//g, '/') // Replace // with /
    .replace(/\\/g, '/') // Replace \ with /
    .replace(/^\//, ''); // Remove leading /
  
  // Ensure path doesn't contain dangerous patterns
  if (sanitized.includes('..') || sanitized.includes('~')) {
    throw new Error('Invalid path');
  }
  
  return sanitized;
};

// Export validators for external use
export const validators = {
  string: safeString,
  email: safeEmail,
  url: safeUrl,
  username: safeUsername,
  password: safePassword,
  int: safeInt,
  float: safeFloat,
  uuid: uuidSchema,
  date: safeDateString,
  currency: currencyAmount,
  sanitizeHtml,
  sanitizeJson,
  sanitizeSqlIdentifier,
  sanitizePath,
};

// Type exports
export type PaginationParams = z.infer<typeof paginationSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MarketDataRequest = z.infer<typeof marketDataRequestSchema>;
export type Transaction = z.infer<typeof transactionSchema>;