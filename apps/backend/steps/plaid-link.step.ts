import { z } from 'zod';
import { createLinkToken } from '../src/mastra/tools/plaid-simple';

export const config = {
  type: 'api' as const,
  name: 'CreatePlaidLinkToken',
  method: 'POST' as const,
  path: '/api/plaid/create-link-token',
  bodySchema: z.object({
    userId: z.string(),
  }),
  emits: ['plaid.link.created'],
  flows: ['plaid-integration'],
};

export const handler = async (req: any, { logger, emit, traceId }: any) => {
  try {
    logger.info('Creating Plaid link token', { userId: req.body.userId, traceId });

    const result = await createLinkToken(req.body.userId);

    await emit({
      topic: 'plaid.link.created',
      data: {
        userId: req.body.userId,
        linkToken: result.link_token,
        traceId,
      },
    });

    return {
      status: 200,
      body: result,
    };
  } catch (error: any) {
    logger.error('Failed to create Plaid link token', { error: error.message, traceId });
    
    return {
      status: 500,
      body: {
        error: 'Failed to create link token',
        message: error.message,
      },
    };
  }
};