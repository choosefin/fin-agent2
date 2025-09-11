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

    const { data, error } = await this.supabaseAdminClient
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

    const { data, error } = await this.supabaseAdminClient
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
   * Get admin client (use with caution, only for admin operations)
   */
  getAdminClient() {
    // Log admin client usage for audit
    console.warn('Admin client accessed - ensure this is intentional');
    return this.supabaseAdminClient;
  }
}

export const authService = new AuthService();