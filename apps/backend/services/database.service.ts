import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolConfig } from 'pg';
import { secretsService } from './secrets.service';

interface DatabaseConfig {
  connectionString?: string;
  poolSize?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class DatabaseService {
  private pool: Pool | null = null;
  private supabaseClient: SupabaseClient | null = null;
  private config: DatabaseConfig;
  private connectionRetries: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: DatabaseConfig = {}) {
    this.config = {
      poolSize: config.poolSize || parseInt(process.env.DB_POOL_SIZE || '20'),
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize database connections
   */
  private async initialize() {
    try {
      // Initialize Supabase client with connection pooling
      await this.initializeSupabase();

      // Initialize PostgreSQL connection pool if direct connection is needed
      if (process.env.DATABASE_URL || this.config.connectionString) {
        await this.initializePostgresPool();
      }

      // Start health check monitoring
      this.startHealthCheck();

      console.log('Database service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Initialize Supabase client
   */
  private async initializeSupabase() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': 'true',
        },
      },
    });
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private async initializePostgresPool() {
    const connectionString = this.config.connectionString || 
                           process.env.DATABASE_URL || 
                           await secretsService.getDatabaseConnectionString();

    const poolConfig: PoolConfig = {
      connectionString,
      max: this.config.poolSize,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      
      // Connection lifecycle hooks
      onConnect: async (client) => {
        // Set up connection-level settings
        await client.query('SET statement_timeout = 30000'); // 30 seconds
        await client.query('SET lock_timeout = 10000'); // 10 seconds
        await client.query('SET idle_in_transaction_session_timeout = 60000'); // 60 seconds
      },
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });

    // Test the connection
    await this.testConnection();
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.checkHealth();
      if (!health.healthy) {
        console.warn('Database health check failed:', health);
        // Attempt to reconnect if unhealthy
        await this.reconnect();
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    supabase: boolean;
    postgres: boolean;
    poolStats?: {
      total: number;
      idle: number;
      waiting: number;
    };
  }> {
    const health = {
      healthy: true,
      supabase: false,
      postgres: false,
      poolStats: undefined as any,
    };

    // Check Supabase connection
    if (this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient
          .from('_health_check')
          .select('id')
          .limit(1);
        
        health.supabase = !error || error.code === 'PGRST116'; // Table doesn't exist is ok
      } catch {
        health.supabase = false;
      }
    }

    // Check PostgreSQL pool
    if (this.pool) {
      health.postgres = await this.testConnection();
      health.poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };
    }

    health.healthy = health.supabase || health.postgres;
    return health;
  }

  /**
   * Reconnect to database
   */
  async reconnect() {
    console.log('Attempting to reconnect to database...');
    
    // Close existing connections
    await this.close();
    
    // Reinitialize
    await this.initialize();
  }

  /**
   * Execute a query with retry logic
   */
  async query<T = any>(
    sql: string,
    params: any[] = [],
    options: { retries?: number } = {}
  ): Promise<T[]> {
    const maxRetries = options.retries ?? this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.pool) {
          const result = await this.pool.query(sql, params);
          return result.rows;
        } else if (this.supabaseClient) {
          // Fallback to Supabase RPC if no direct pool
          throw new Error('Direct SQL not available, use Supabase client methods');
        } else {
          throw new Error('No database connection available');
        }
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await this.delay(this.config.retryDelay! * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('Query failed after retries');
  }

  /**
   * Execute a transaction
   */
  async transaction<T = any>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Transaction requires direct database connection');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual control
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('No connection pool available');
    }
    
    return await this.pool.connect();
  }

  /**
   * Release a client back to the pool
   */
  releaseClient(client: any) {
    if (client && typeof client.release === 'function') {
      client.release();
    }
  }

  /**
   * Get Supabase client for Supabase-specific operations
   */
  getSupabaseClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    return this.supabaseClient;
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryableCodes = [
      '23505', // unique_violation
      '23503', // foreign_key_violation
      '23502', // not_null_violation
      '23514', // check_violation
      '22P02', // invalid_text_representation
      '42P01', // undefined_table
      '42703', // undefined_column
    ];

    return nonRetryableCodes.includes(error.code);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections
   */
  async close() {
    this.stopHealthCheck();

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    this.supabaseClient = null;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down database service...');
    await this.close();
    console.log('Database service shut down complete');
  }
}

// Singleton instance
export const databaseService = new DatabaseService();

// Helper functions for common queries
export const db = {
  /**
   * Execute a SELECT query
   */
  async select<T = any>(
    table: string,
    conditions: Record<string, any> = {},
    options: { limit?: number; offset?: number; orderBy?: string } = {}
  ): Promise<T[]> {
    const whereClause = Object.keys(conditions).length > 0
      ? `WHERE ${Object.keys(conditions).map((key, i) => `${key} = $${i + 1}`).join(' AND ')}`
      : '';
    
    const orderClause = options.orderBy ? `ORDER BY ${options.orderBy}` : '';
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';
    
    const sql = `
      SELECT * FROM ${table}
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${offsetClause}
    `.trim();
    
    return databaseService.query<T>(sql, Object.values(conditions));
  },

  /**
   * Execute an INSERT query
   */
  async insert<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `.trim();
    
    const result = await databaseService.query<T>(sql, values);
    return result[0];
  },

  /**
   * Execute an UPDATE query
   */
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    conditions: Record<string, any>
  ): Promise<T[]> {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = conditionKeys.map((key, i) => `${key} = $${dataKeys.length + i + 1}`).join(' AND ');
    
    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `.trim();
    
    return databaseService.query<T>(sql, [...dataValues, ...conditionValues]);
  },

  /**
   * Execute a DELETE query
   */
  async delete(
    table: string,
    conditions: Record<string, any>
  ): Promise<number> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    
    const sql = `
      DELETE FROM ${table}
      WHERE ${whereClause}
    `.trim();
    
    const result = await databaseService.query(sql, values);
    return result.length;
  },
};