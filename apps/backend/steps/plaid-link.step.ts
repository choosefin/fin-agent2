import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';
import { plaidTool } from '../src/mastra/tools/plaid';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreatePlaidLinkToken',
  method: 'POST',
  path: '/api/plaid/create-link-token',
  bodySchema: z.object({
    userId: z.string(),
  }),
  emits: ['plaid.link.created'],
  flows: ['plaid-integration'],
};

export const handler: Handlers['CreatePlaidLinkToken'] = async (req, { logger, emit, traceId }) => {
  try {
    logger.info('Creating Plaid link token', { userId: req.body.userId, traceId });

    const result = await plaidTool.execute({
      action: 'createLinkToken',
      userId: req.body.userId,
    });

    await emit({
      topic: 'plaid.link.created',
      data: {
        userId: req.body.userId,
        linkToken: result.linkToken,
        traceId,
      },
    });

    return {
      status: 200,
      body: {
        link_token: result.linkToken,
        expiration: result.expiration,
      },
    };
  } catch (error) {
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