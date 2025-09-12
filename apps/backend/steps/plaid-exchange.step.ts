import { z } from 'zod';
import { exchangePublicToken } from '../src/mastra/tools/plaid-simple';

export const config = {
  type: 'api' as const,
  name: 'ExchangePlaidToken',
  method: 'POST' as const,
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

export const handler = async (req: any, { logger, emit, state, traceId }: any) => {
  try {
    logger.info('Exchanging Plaid public token', { userId: req.body.userId, traceId });

    const result = await exchangePublicToken(req.body.publicToken);

    // Store connection info
    if (state && state.set) {
      await state.set('plaid-connections', result.item_id, {
        userId: req.body.userId,
        itemId: result.item_id,
        institution: req.body.institution,
        connectedAt: new Date().toISOString(),
      });
    }

    await emit({
      topic: 'plaid.token.exchanged',
      data: {
        userId: req.body.userId,
        itemId: result.item_id,
        traceId,
      },
    });

    await emit({
      topic: 'plaid.accounts.connected',
      data: {
        userId: req.body.userId,
        itemId: result.item_id,
        accountCount: req.body.accounts?.length || 0,
        traceId,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        itemId: result.item_id,
      },
    };
  } catch (error: any) {
    logger.error('Failed to exchange Plaid token', { 
      error: error.message, 
      userId: req.body.userId,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to exchange token',
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred' 
          : error.message,
      },
    };
  }
};