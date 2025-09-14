import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily to avoid initialization errors
let supabase: any = null;

const getSupabase = () => {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return supabase;
};

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateChatSession',
  method: 'POST',
  path: '/api/chat/sessions',
  bodySchema: z.object({
    userId: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']).optional().default('general'),
    initialMessage: z.string().optional(),
  }),
  emits: ['chat.session.created'],
};

export const handler: Handlers['CreateChatSession'] = async (req, { logger, emit, state }) => {
  try {
    const { userId, assistantType, initialMessage } = req.body;
    
    logger.info('Creating new chat session', { userId, assistantType });

    const db = getSupabase();
    if (!db) {
      logger.error('Supabase not configured');
      return {
        status: 503,
        body: { error: 'Database service not configured' },
      };
    }

    // Create chat session in database
    const { data: chatSession, error: sessionError } = await db
      .from('chat_sessions')
      .insert({
        user_id: userId,
        assistant_type: assistantType,
        title: initialMessage ? initialMessage.substring(0, 100) : null,
      })
      .select()
      .single();

    if (sessionError) {
      logger.error('Failed to create chat session', { error: sessionError });
      return {
        status: 500,
        body: { error: 'Failed to create chat session', details: sessionError.message },
      };
    }

    // If there's an initial message, save it
    if (initialMessage) {
      const { error: messageError } = await db
        .from('chat_messages')
        .insert({
          chat_session_id: chatSession.id,
          role: 'user',
          content: initialMessage,
          metadata: { assistantType },
        });

      if (messageError) {
        logger.error('Failed to save initial message', { error: messageError });
      }
    }

    // Store session in Motia state for quick access
    await state.set('chat_sessions', chatSession.id, {
      ...chatSession,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Emit event for other services
    await emit({
      topic: 'chat.session.created',
      data: {
        sessionId: chatSession.id,
        userId,
        assistantType,
      },
    });

    logger.info('Chat session created successfully', { sessionId: chatSession.id });

    return {
      status: 201,
      body: {
        sessionId: chatSession.id,
        url: `/chat/${chatSession.id}`,
        chatSession,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create chat session', { error: errorMessage });
    
    return {
      status: 500,
      body: { error: 'Failed to create chat session', message: errorMessage },
    };
  }
};