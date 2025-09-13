// Mastra Memory Manager with mem0 integration
import { Memory } from '@mastra/core';
import { supabase } from '../db/supabase';
import { AgentType } from '../agents/financial-agents';

interface MemoryContext {
  userId: string;
  agentType: AgentType;
  sessionId?: string;
}

interface MemoryEntry {
  key: string;
  value: any;
  metadata?: {
    timestamp: string;
    ttl?: number;
    tags?: string[];
    importance?: number;
  };
}

export class FinancialMemoryManager {
  private memory: Memory;
  private context: MemoryContext;

  constructor(context: MemoryContext) {
    this.context = context;
    this.memory = new Memory({
      provider: 'mem0', // Using mem0 as the memory provider
      config: {
        apiKey: process.env.MEM0_API_KEY,
        organizationId: process.env.MEM0_ORG_ID,
      },
    });
  }

  /**
   * Store a memory entry
   */
  async store(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      // Store in mem0
      await this.memory.set(this.buildKey(key), value, {
        ttl: ttlSeconds,
        metadata: {
          userId: this.context.userId,
          agentType: this.context.agentType,
          sessionId: this.context.sessionId,
          timestamp: new Date().toISOString(),
        },
      });

      // Also store in Supabase for persistence
      await supabase.from('agent_memory').upsert({
        user_id: this.context.userId,
        agent_type: this.context.agentType,
        memory_key: key,
        memory_value: value,
        context: {
          sessionId: this.context.sessionId,
        },
        ttl_seconds: ttlSeconds,
        expires_at: ttlSeconds 
          ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
          : null,
      });
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve a memory entry
   */
  async retrieve(key: string): Promise<any> {
    try {
      // Try to get from mem0 first (faster)
      const mem0Value = await this.memory.get(this.buildKey(key));
      if (mem0Value) {
        return mem0Value;
      }

      // Fallback to Supabase
      const { data } = await supabase
        .from('agent_memory')
        .select('memory_value, expires_at')
        .eq('user_id', this.context.userId)
        .eq('agent_type', this.context.agentType)
        .eq('memory_key', key)
        .single();

      if (data) {
        // Check if expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          await this.delete(key);
          return null;
        }
        
        // Re-populate mem0 cache
        await this.memory.set(this.buildKey(key), data.memory_value);
        return data.memory_value;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve memory:', error);
      return null;
    }
  }

  /**
   * Delete a memory entry
   */
  async delete(key: string): Promise<void> {
    try {
      // Delete from mem0
      await this.memory.delete(this.buildKey(key));

      // Delete from Supabase
      await supabase
        .from('agent_memory')
        .delete()
        .eq('user_id', this.context.userId)
        .eq('agent_type', this.context.agentType)
        .eq('memory_key', key);
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  }

  /**
   * Search memories by pattern
   */
  async search(pattern: string, limit: number = 10): Promise<MemoryEntry[]> {
    try {
      // Search in mem0
      const mem0Results = await this.memory.search(pattern, {
        filter: {
          userId: this.context.userId,
          agentType: this.context.agentType,
        },
        limit,
      });

      if (mem0Results && mem0Results.length > 0) {
        return mem0Results.map((result: any) => ({
          key: result.key,
          value: result.value,
          metadata: result.metadata,
        }));
      }

      // Fallback to Supabase search
      const { data } = await supabase
        .from('agent_memory')
        .select('*')
        .eq('user_id', this.context.userId)
        .eq('agent_type', this.context.agentType)
        .ilike('memory_key', `%${pattern}%`)
        .limit(limit);

      return (data || []).map(item => ({
        key: item.memory_key,
        value: item.memory_value,
        metadata: {
          timestamp: item.created_at,
          ttl: item.ttl_seconds,
        },
      }));
    } catch (error) {
      console.error('Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Store conversation context
   */
  async storeConversation(messages: any[], summary?: string): Promise<void> {
    const conversationKey = `conversation_${this.context.sessionId || Date.now()}`;
    
    await this.store(conversationKey, {
      messages,
      summary,
      participantCount: messages.length,
      startTime: messages[0]?.timestamp,
      endTime: messages[messages.length - 1]?.timestamp,
    });

    // Store summary for quick retrieval
    if (summary) {
      await this.store(`summary_${conversationKey}`, summary, 86400 * 30); // 30 days TTL
    }
  }

  /**
   * Store user preferences
   */
  async storePreferences(preferences: any): Promise<void> {
    await this.store('user_preferences', preferences);
    
    // Also update in user_preferences table
    await supabase
      .from('user_preferences')
      .upsert({
        user_id: this.context.userId,
        ...preferences,
      });
  }

  /**
   * Retrieve user preferences
   */
  async retrievePreferences(): Promise<any> {
    const cached = await this.retrieve('user_preferences');
    if (cached) return cached;

    // Fetch from database
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', this.context.userId)
      .single();

    if (data) {
      // Cache for future use
      await this.store('user_preferences', data, 3600); // 1 hour cache
    }

    return data;
  }

  /**
   * Store financial context (portfolio, positions, etc.)
   */
  async storeFinancialContext(context: any): Promise<void> {
    await this.store('financial_context', context, 1800); // 30 minutes cache
  }

  /**
   * Retrieve financial context
   */
  async retrieveFinancialContext(): Promise<any> {
    const cached = await this.retrieve('financial_context');
    if (cached) return cached;

    // Build context from database
    const [portfolios, watchlists, alerts] = await Promise.all([
      supabase
        .from('portfolios')
        .select('*, accounts(*, positions(*))')
        .eq('user_id', this.context.userId),
      supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', this.context.userId),
      supabase
        .from('alerts')
        .select('*')
        .eq('user_id', this.context.userId)
        .eq('is_active', true),
    ]);

    const context = {
      portfolios: portfolios.data,
      watchlists: watchlists.data,
      activeAlerts: alerts.data,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the context
    await this.storeFinancialContext(context);

    return context;
  }

  /**
   * Store market insights
   */
  async storeMarketInsight(symbol: string, insight: any): Promise<void> {
    const key = `market_insight_${symbol}`;
    await this.store(key, {
      ...insight,
      symbol,
      timestamp: new Date().toISOString(),
    }, 3600); // 1 hour cache
  }

  /**
   * Retrieve market insights
   */
  async retrieveMarketInsights(symbols: string[]): Promise<any[]> {
    const insights = await Promise.all(
      symbols.map(symbol => this.retrieve(`market_insight_${symbol}`))
    );
    
    return insights.filter(Boolean);
  }

  /**
   * Store agent decision rationale
   */
  async storeDecisionRationale(
    decision: string,
    rationale: string,
    confidence: number,
    evidence: any[]
  ): Promise<void> {
    const key = `decision_${Date.now()}`;
    await this.store(key, {
      decision,
      rationale,
      confidence,
      evidence,
      agentType: this.context.agentType,
      timestamp: new Date().toISOString(),
    }, 86400 * 7); // 7 days retention
  }

  /**
   * Retrieve recent decisions
   */
  async retrieveRecentDecisions(limit: number = 5): Promise<any[]> {
    const decisions = await this.search('decision_', limit);
    return decisions
      .map(d => d.value)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clear expired memories
   */
  async clearExpired(): Promise<void> {
    try {
      // Clear expired entries from Supabase
      await supabase
        .from('agent_memory')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .eq('user_id', this.context.userId);

      // mem0 handles its own expiration
    } catch (error) {
      console.error('Failed to clear expired memories:', error);
    }
  }

  /**
   * Build a namespaced key
   */
  private buildKey(key: string): string {
    return `${this.context.userId}_${this.context.agentType}_${key}`;
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<any> {
    const { data, count } = await supabase
      .from('agent_memory')
      .select('*', { count: 'exact', head: false })
      .eq('user_id', this.context.userId)
      .eq('agent_type', this.context.agentType);

    const totalSize = data?.reduce((sum, item) => 
      sum + JSON.stringify(item.memory_value).length, 0
    ) || 0;

    return {
      totalEntries: count || 0,
      totalSizeBytes: totalSize,
      oldestEntry: data?.[0]?.created_at,
      newestEntry: data?.[data.length - 1]?.created_at,
    };
  }
}

// Context-aware memory helper for agents
export class AgentMemoryHelper {
  private memoryManager: FinancialMemoryManager;

  constructor(userId: string, agentType: AgentType, sessionId?: string) {
    this.memoryManager = new FinancialMemoryManager({
      userId,
      agentType,
      sessionId,
    });
  }

  /**
   * Remember user intent from conversation
   */
  async rememberIntent(intent: string, entities: any[]): Promise<void> {
    await this.memoryManager.store('last_intent', {
      intent,
      entities,
      timestamp: new Date().toISOString(),
    }, 3600); // 1 hour
  }

  /**
   * Get remembered intent
   */
  async getLastIntent(): Promise<any> {
    return this.memoryManager.retrieve('last_intent');
  }

  /**
   * Remember analysis results
   */
  async rememberAnalysis(symbol: string, analysis: any): Promise<void> {
    await this.memoryManager.storeMarketInsight(symbol, analysis);
  }

  /**
   * Get previous analysis
   */
  async getPreviousAnalysis(symbol: string): Promise<any> {
    return this.memoryManager.retrieve(`market_insight_${symbol}`);
  }

  /**
   * Build context from memory
   */
  async buildContext(): Promise<any> {
    const [preferences, financialContext, recentDecisions] = await Promise.all([
      this.memoryManager.retrievePreferences(),
      this.memoryManager.retrieveFinancialContext(),
      this.memoryManager.retrieveRecentDecisions(3),
    ]);

    return {
      userPreferences: preferences,
      portfolioContext: financialContext,
      recentDecisions,
      timestamp: new Date().toISOString(),
    };
  }
}