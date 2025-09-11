import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';
// Debate workflow temporarily disabled
// import { debateWorkflow } from '../src/mastra/workflows/debate';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ChatWithAgent',
  method: 'POST',
  path: '/api/chat',
  bodySchema: z.object({
    message: z.string(),
    assistantType: z.enum(['general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist']),
    userId: z.string(),
    symbols: z.array(z.string()).optional(),
  }),
  emits: ['chat.received', 'analysis.completed'],
  flows: ['financial-analysis'],
};

export const handler: Handlers['ChatWithAgent'] = async (req, { logger, emit, state, traceId }) => {
  try {
    logger.info('Processing chat request', { 
      assistantType: req.body.assistantType,
      traceId 
    });

    // Store the chat message
    await state.set('chats', traceId, {
      message: req.body.message,
      assistantType: req.body.assistantType,
      userId: req.body.userId,
      timestamp: new Date().toISOString(),
    });

    // Emit chat received event
    await emit({ 
      topic: 'chat.received', 
      data: {
        traceId,
        message: req.body.message,
        assistantType: req.body.assistantType,
      }
    });

    // Debate workflow temporarily disabled - return a placeholder response
    const result = {
      output: {
        response: "The debate workflow is temporarily disabled. This is a placeholder response.",
        confidence: 0.5,
        sources: [],
        participants: []
      }
    };

    // Emit analysis completed event
    await emit({ 
      topic: 'analysis.completed', 
      data: {
        traceId,
        result: result.narrative,
      }
    });

    return {
      status: 200,
      body: {
        response: result.narrative,
        traceId,
        assistantType: req.body.assistantType,
        participantAgents: result.participantAgents,
        debateRounds: result.debateRounds,
      },
    };
  } catch (error) {
    logger.error('Chat processing failed', { 
      error: error.message,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to process chat request',
        message: error.message,
      },
    };
  }
};