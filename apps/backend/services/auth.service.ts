import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';

// JWT validation schema
const jwtPayloadSchema = z.object({
  sub: z.string(), // user id
  email: z.string().email().optional(),
  role: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
  aud: z.string().optional(),
});

export class AuthService {
  private supabaseClient: SupabaseClient;
  private supabaseAdminClient: SupabaseClient;
  
  constructor() {
    // Public client for user operations (using anon key)
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Admin client for service operations (using service key)
    // This should only be used for specific admin operations
    this.supabaseAdminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Verify JWT token and extract user context
   */
  async verifyToken(token: string): Promise<{ userId: string; email?: string; role?: string }> {
    try {
      // Verify JWT with Supabase
      const { data: { user }, error } = await this.supabaseClient.auth.getUser(token);
      
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
   * Admin operations - specific methods only, no direct client access
   */
  async adminCreateUser(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await this.supabaseAdminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    await this.logAdminAction('CREATE_USER', { email });
    return data;
  }

  async adminUpdateUser(userId: string, updates: { email?: string; password?: string; metadata?: Record<string, any> }) {
    const { data, error } = await this.supabaseAdminClient.auth.admin.updateUserById(
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

    await this.logAdminAction('UPDATE_USER', { userId });
    return data;
  }

  async adminDeleteUser(userId: string) {
    const { error } = await this.supabaseAdminClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    await this.logAdminAction('DELETE_USER', { userId });
  }

  async adminListUsers(page: number = 1, perPage: number = 50) {
    const { data, error } = await this.supabaseAdminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    await this.logAdminAction('LIST_USERS', { page, perPage });
    return data;
  }

  async adminGrantPermission(userId: string, resource: string, action: string) {
    const { error } = await this.supabaseAdminClient
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

    await this.logAdminAction('GRANT_PERMISSION', { userId, resource, action });
  }

  async adminRevokePermission(userId: string, resource: string, action: string) {
    const { error } = await this.supabaseAdminClient
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('resource', resource)
      .eq('action', action);

    if (error) {
      throw new Error(`Failed to revoke permission: ${error.message}`);
    }

    await this.logAdminAction('REVOKE_PERMISSION', { userId, resource, action });
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