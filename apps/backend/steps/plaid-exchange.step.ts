import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';
import { plaidTool } from '../src/mastra/tools/plaid';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ExchangePlaidToken',
  method: 'POST',
  path: '/api/plaid/exchange-token',
  bodySchema: z.object({
    publicToken: z.string(),
    userId: z.string(),
    institution: z.any().optional(),
    accounts: z.array(z.any()).optional(),
  }),
  emits: ['plaid.token.exchanged', 'plaid.accounts.connected'],
  flows: ['plaid-integration'],
};

export const handler: Handlers['ExchangePlaidToken'] = async (req, { logger, emit, state, traceId }) => {
  try {
    logger.info('Exchanging Plaid public token', { userId: req.body.userId, traceId });

    const result = await plaidTool.execute({
      action: 'exchangeToken',
      userId: req.body.userId,
      publicToken: req.body.publicToken,
    });

    // Store connection info
    await state.set('plaid-connections', result.itemId, {
      userId: req.body.userId,
      itemId: result.itemId,
      institution: req.body.institution,
      connectedAt: new Date().toISOString(),
    });

    await emit({
      topic: 'plaid.token.exchanged',
      data: {
        userId: req.body.userId,
        itemId: result.itemId,
        traceId,
      },
    });

    // Trigger account sync
    await plaidTool.execute({
      action: 'syncAccounts',
      userId: req.body.userId,
    });

    await emit({
      topic: 'plaid.accounts.connected',
      data: {
        userId: req.body.userId,
        itemId: result.itemId,
        accountCount: req.body.accounts?.length || 0,
        traceId,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        itemId: result.itemId,
      },
    };
  } catch (error) {
    logger.error('Failed to exchange Plaid token', { error: error.message, traceId });
    
    return {
      status: 500,
      body: {
        error: 'Failed to exchange token',
        message: error.message,
      },
    };
  }
};