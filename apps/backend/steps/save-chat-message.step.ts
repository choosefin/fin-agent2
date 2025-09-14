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
  name: 'SaveChatMessage',
  method: 'POST',
  path: '/api/chat/messages',
  bodySchema: z.object({
    sessionId: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    threadId: z.string().optional(),
    parentMessageId: z.string().optional(),
    metadata: z.object({
      provider: z.string().optional(),
      model: z.string().optional(),
      tokens: z.number().optional(),
      assistantType: z.string().optional(),
      workflowId: z.string().optional(),
    }).optional(),
  }),
  emits: ['chat.message.saved'],
};

export const handler: Handlers['SaveChatMessage'] = async (req, { logger, emit, state }) => {
  try {
    const { sessionId, role, content, threadId, parentMessageId, metadata } = req.body;
    
    logger.info('Saving chat message', { sessionId, role, contentLength: content.length });

    const db = getSupabase();
    if (!db) {
      logger.error('Supabase not configured');
      return {
        status: 503,
        body: { error: 'Database service not configured' },
      };
    }

    // Verify session exists
    const { data: session, error: sessionError } = await db
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      logger.error('Chat session not found', { sessionId });
      return {
        status: 404,
        body: { error: 'Chat session not found' },
      };
    }

    // Generate thread ID if this is a reply but no thread ID provided
    let actualThreadId = threadId;
    if (parentMessageId && !threadId) {
      // Check if parent message has a thread ID
      const { data: parentMessage } = await db
        .from('chat_messages')
        .select('thread_id')
        .eq('id', parentMessageId)
        .single();
      
      actualThreadId = parentMessage?.thread_id || crypto.randomUUID();
    }

    // Save the message
    const { data: message, error: messageError } = await db
      .from('chat_messages')
      .insert({
        chat_session_id: sessionId,
        role,
        content,
        thread_id: actualThreadId,
        parent_message_id: parentMessageId,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (messageError) {
      logger.error('Failed to save message', { error: messageError });
      return {
        status: 500,
        body: { error: 'Failed to save message', details: messageError.message },
      };
    }

    // Update metadata if provider info is provided
    if (metadata?.provider || metadata?.tokens) {
      const { data: currentMetadata } = await db
        .from('chat_metadata')
        .select('*')
        .eq('chat_session_id', sessionId)
        .single();

      const updatedProviders = currentMetadata?.providers_used || [];
      if (metadata.provider && !updatedProviders.includes(metadata.provider)) {
        updatedProviders.push(metadata.provider);
      }

      const totalTokens = (currentMetadata?.total_tokens || 0) + (metadata.tokens || 0);

      await db
        .from('chat_metadata')
        .update({
          total_tokens: totalTokens,
          providers_used: updatedProviders,
        })
        .eq('chat_session_id', sessionId);
    }

    // Update session in Motia state
    await state.set('chat_messages', `${sessionId}:${message.id}`, message);

    // Emit event
    await emit({
      topic: 'chat.message.saved',
      data: {
        sessionId,
        messageId: message.id,
        role,
        threadId: actualThreadId,
      },
    });

    logger.info('Message saved successfully', { messageId: message.id });

    return {
      status: 201,
      body: {
        message,
        threadId: actualThreadId,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save message', { error: errorMessage });
    
    return {
      status: 500,
      body: { error: 'Failed to save message', message: errorMessage },
    };
  }
};