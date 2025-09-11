import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { z } from 'zod';

// JWT validation schema (unused currently but kept for future JWT validation)
const jwtPayloadSchema = z.object({
  sub: z.string(), // user id
  email: z.string().email().optional(),
  role: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
  aud: z.string().optional(),
});

export class AuthService {
  private supabaseClient: SupabaseClient | null = null;
  private supabaseAdminClient: SupabaseClient | null = null;
  private allowedAdminIPs: Set<string>;
  private adminAccessLog: Map<string, { count: number; lastAccess: Date }>;
  
  constructor() {
    // Initialize allowed admin IPs from environment
    this.allowedAdminIPs = new Set(
      process.env.ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || []
    );
    this.adminAccessLog = new Map();
    
    // Only initialize Supabase clients if environment variables are present
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      // Public client for user operations (using anon key)
      this.supabaseClient = createClient(
        supabaseUrl,
        supabaseAnonKey
      );
    }

    if (supabaseUrl && supabaseServiceKey) {
      // Admin client for service operations (using service key)
      // This should only be used for specific admin operations
      this.supabaseAdminClient = createClient(
        supabaseUrl,
        supabaseServiceKey
      );
    }
  }
  
  private ensureSupabaseClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
    }
    return this.supabaseClient;
  }
  
  private ensureSupabaseAdminClient(): SupabaseClient {
    if (!this.supabaseAdminClient) {
      throw new Error('Supabase admin client not initialized. Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.');
    }
    return this.supabaseAdminClient;
  }

  /**
   * Verify JWT token and extract user context
   */
  async verifyToken(token: string): Promise<{ userId: string; email?: string; role?: string }> {
    try {
      // Verify JWT with Supabase
      const { data: { user }, error } = await this.ensureSupabaseClient().auth.getUser(token);
      
      if (error || !user) {
        throw new Error('Invalid token');
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      throw new Error('Token verification failed');
    }
  }

  /**
   * Create a session for a user
   */
  async createSession(userId: string, metadata?: Record<string, any>) {
    // Validate userId format (must be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Validate and limit metadata size
    if (metadata) {
      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 10000) { // 10KB limit
        throw new Error('Metadata too large (max 10KB)');
      }
      
      // Sanitize metadata - remove sensitive keys
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
      for (const key of Object.keys(metadata)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          delete metadata[key];
        }
      }
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { data, error } = await this.supabaseClient
      .from('user_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create session');
    }

    await this.logSecurityEvent('SESSION_CREATED', userId, { sessionId });
    return data;
  }

  /**
   * Validate user session
   */
  async validateSession(sessionId: string) {
    const { data, error } = await this.supabaseClient
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if session is expired
    if (new Date(data.expires_at) < new Date()) {
      await this.invalidateSession(sessionId);
      return null;
    }

    return data;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string) {
    await this.supabaseClient
      .from('user_sessions')
      .delete()
      .eq('id', sessionId);
  }

  /**
   * Check user permissions for a specific resource
   */
  async checkUserPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const { data, error } = await this.supabaseClient
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('resource', resource)
      .eq('action', action)
      .single();

    return !error && !!data;
  }

  /**
   * Get user by ID (using anon key for safety)
   */
  async getUserById(userId: string) {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('id, email, created_at, metadata')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error('User not found');
    }

    return data;
  }

  /**
   * Create API key for service-to-service authentication
   */
  async createApiKey(userId: string, name: string, scopes: string[] = []) {
    // Validate userId format (must be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Validate name
    if (!name || name.length < 3 || name.length > 100) {
      throw new Error('API key name must be between 3 and 100 characters');
    }
    
    // Sanitize name - only allow alphanumeric, spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      throw new Error('API key name contains invalid characters');
    }

    // Validate scopes
    if (scopes.length > 20) {
      throw new Error('Too many scopes (max 20)');
    }
    
    const validScopes = ['read', 'write', 'delete', 'admin', 'api', 'user', 'data'];
    for (const scope of scopes) {
      if (typeof scope !== 'string' || scope.length > 50) {
        throw new Error('Invalid scope format');
      }
      // Optionally validate against allowed scopes
      if (process.env.ENFORCE_SCOPE_LIST === 'true' && !validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }

    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data, error } = await this.supabaseClient
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        key_hash: hashedKey,
        scopes,
        last_used_at: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create API key');
    }

    await this.logSecurityEvent('API_KEY_CREATED', userId, { keyName: name });
    // Return the API key only once (user must save it)
    return { ...data, apiKey };
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string) {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data, error } = await this.supabaseClient
      .from('api_keys')
      .select('*')
      .eq('key_hash', hashedKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Update last used timestamp
    await this.supabaseClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return data;
  }

  /**
   * Get public Supabase client (safe for client-side operations)
   */
  getPublicClient() {
    return this.supabaseClient;
  }

  /**
   * Check if IP is allowed for admin operations
   */
  private isAdminIPAllowed(ip: string): boolean {
    // In production, require IP whitelist
    if (process.env.NODE_ENV === 'production') {
      return this.allowedAdminIPs.has(ip);
    }
    
    // In development, allow local IPs
    const localIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    return localIPs.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.');
  }

  /**
   * Validate admin access
   */
  private async validateAdminAccess(
    userId: string,
    action: string,
    ip?: string
  ): Promise<void> {
    // Check IP restrictions
    if (ip && !this.isAdminIPAllowed(ip)) {
      await this.logSecurityEvent('ADMIN_ACCESS_DENIED_IP', userId, {
        action,
        ip,
        severity: 'high',
      });
      throw new Error('Admin access denied: IP not allowed');
    }

    // Check user has admin role
    const { data: user } = await this.supabaseClient
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || user.role !== 'admin') {
      await this.logSecurityEvent('ADMIN_ACCESS_DENIED_ROLE', userId, {
        action,
        severity: 'high',
      });
      throw new Error('Admin access denied: Insufficient privileges');
    }

    // Rate limit admin operations (max 100 per hour)
    const key = `admin:${userId}`;
    const accessLog = this.adminAccessLog.get(key);
    const now = new Date();
    
    if (accessLog) {
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      if (accessLog.lastAccess > hourAgo && accessLog.count >= 100) {
        await this.logSecurityEvent('ADMIN_RATE_LIMIT', userId, {
          action,
          count: accessLog.count,
          severity: 'medium',
        });
        throw new Error('Admin rate limit exceeded');
      }
      
      if (accessLog.lastAccess < hourAgo) {
        accessLog.count = 1;
        accessLog.lastAccess = now;
      } else {
        accessLog.count++;
      }
    } else {
      this.adminAccessLog.set(key, { count: 1, lastAccess: now });
    }
  }

  /**
   * Admin operations - specific methods only, no direct client access
   */
  async adminCreateUser(
    email: string, 
    password: string, 
    metadata?: Record<string, any>,
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'CREATE_USER', context.ip);
    }
    const { data, error } = await this.ensureSupabaseAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    await this.logAdminAction('CREATE_USER', { 
      email,
      performedBy: context?.userId,
      ip: context?.ip,
    });
    return data;
  }

  async adminUpdateUser(
    userId: string, 
    updates: { email?: string; password?: string; metadata?: Record<string, any> },
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'UPDATE_USER', context.ip);
    }
    
    const { data, error } = await this.ensureSupabaseAdminClient().auth.admin.updateUserById(
      userId,
      {
        email: updates.email,
        password: updates.password,
        user_metadata: updates.metadata,
      }
    );

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    await this.logAdminAction('UPDATE_USER', { 
      userId,
      performedBy: context?.userId,
      ip: context?.ip,
    });
    return data;
  }

  async adminDeleteUser(
    userId: string,
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'DELETE_USER', context.ip);
    }
    
    const { error } = await this.ensureSupabaseAdminClient().auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    await this.logAdminAction('DELETE_USER', { 
      userId,
      performedBy: context?.userId,
      ip: context?.ip,
    });
  }

  async adminListUsers(
    page: number = 1, 
    perPage: number = 50,
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'LIST_USERS', context.ip);
    }
    
    const { data, error } = await this.ensureSupabaseAdminClient().auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    await this.logAdminAction('LIST_USERS', { 
      page, 
      perPage,
      performedBy: context?.userId,
      ip: context?.ip,
    });
    return data;
  }

  async adminGrantPermission(
    userId: string, 
    resource: string, 
    action: string,
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'GRANT_PERMISSION', context.ip);
    }
    
    const { error } = await this.ensureSupabaseAdminClient()
      .from('user_permissions')
      .insert({
        user_id: userId,
        resource,
        action,
        granted_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to grant permission: ${error.message}`);
    }

    await this.logAdminAction('GRANT_PERMISSION', { 
      userId, 
      resource, 
      action,
      performedBy: context?.userId,
      ip: context?.ip,
    });
  }

  async adminRevokePermission(
    userId: string, 
    resource: string, 
    action: string,
    context?: { userId: string; ip?: string }
  ) {
    // Validate admin access
    if (context) {
      await this.validateAdminAccess(context.userId, 'REVOKE_PERMISSION', context.ip);
    }
    
    const { error } = await this.ensureSupabaseAdminClient()
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('resource', resource)
      .eq('action', action);

    if (error) {
      throw new Error(`Failed to revoke permission: ${error.message}`);
    }

    await this.logAdminAction('REVOKE_PERMISSION', { 
      userId, 
      resource, 
      action,
      performedBy: context?.userId,
      ip: context?.ip,
    });
  }

  private async logAdminAction(action: string, details: Record<string, any>) {
    try {
      await this.supabaseClient
        .from('audit_logs')
        .insert({
          action: `ADMIN_${action}`,
          resource_type: 'admin',
          details,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  }

  private async logSecurityEvent(event: string, userId: string, details: Record<string, any>) {
    try {
      await this.supabaseClient
        .from('security_events')
        .insert({
          event_type: event,
          severity: 'low',
          user_id: userId,
          details,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

export const authService = new AuthService();