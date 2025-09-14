import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetChatHistory',
  method: 'GET',
  path: '/api/chat/sessions',
  querySchema: z.object({
    userId: z.string(),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
    archived: z.string().optional().transform(val => val === 'true'),
  }),
  emits: [],
};

export const handler: Handlers['GetChatHistory'] = async (req, { logger }) => {
  try {
    const { userId, limit, offset, archived } = req.query;
    
    logger.info('Fetching chat history', { userId, limit, offset, archived });

    // Build query
    let query = supabase
      .from('chat_sessions')
      .select(`
        *,
        chat_metadata (
          total_messages,
          total_tokens,
          providers_used,
          tags,
          last_activity
        )
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by archived status if specified
    if (archived !== undefined) {
      query = query.eq('is_archived', archived);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch chat history', { error });
      return {
        status: 500,
        body: { error: 'Failed to fetch chat history', details: error.message },
      };
    }

    // Get the last message for each session for preview
    const sessionIds = sessions?.map(s => s.id) || [];
    let lastMessages: any[] = [];
    
    if (sessionIds.length > 0) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('chat_session_id, content, role, created_at')
        .in('chat_session_id', sessionIds)
        .order('created_at', { ascending: false });

      // Group by session and get the latest message
      const messageMap = new Map();
      messages?.forEach(msg => {
        if (!messageMap.has(msg.chat_session_id)) {
          messageMap.set(msg.chat_session_id, msg);
        }
      });
      lastMessages = Array.from(messageMap.values());
    }

    // Combine sessions with their last messages
    const sessionsWithPreviews = sessions?.map(session => ({
      ...session,
      lastMessage: lastMessages.find(m => m.chat_session_id === session.id),
      url: `/chat/${session.id}`,
    })) || [];

    logger.info('Chat history fetched successfully', { 
      userId, 
      sessionCount: sessionsWithPreviews.length 
    });

    return {
      status: 200,
      body: {
        sessions: sessionsWithPreviews,
        total: count || 0,
        limit,
        offset,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch chat history', { error: errorMessage });
    
    return {
      status: 500,
      body: { error: 'Failed to fetch chat history', message: errorMessage },
    };
  }
};