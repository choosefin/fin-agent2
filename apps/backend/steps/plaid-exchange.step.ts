import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from '@motia/core';
import { plaidTool } from '../src/mastra/tools/plaid';
import { withAuth, sanitizeInput } from '../middleware/auth.middleware';

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

export const handler: Handlers['ExchangePlaidToken'] = withAuth(
  async (req, { logger, emit, state, traceId }) => {
    try {
      // Sanitize input
      const bodySchema = z.object({
        publicToken: z.string().min(1).max(500),
        userId: z.string().uuid(),
        institution: z.any().optional(),
        accounts: z.array(z.any()).optional(),
      });

      const sanitizedBody = sanitizeInput(req.body, bodySchema);
      
      // Verify the userId matches the authenticated user
      if (sanitizedBody.userId !== req.auth.userId) {
        logger.warn('User ID mismatch', { 
          providedUserId: sanitizedBody.userId,
          authUserId: req.auth.userId,
          traceId 
        });
        return {
          status: 403,
          body: { error: 'Unauthorized: User ID mismatch' },
        };
      }

      logger.info('Exchanging Plaid public token', { userId: req.auth.userId, traceId });

      const result = await plaidTool.execute({
        action: 'exchangeToken',
        userId: req.auth.userId,
        publicToken: sanitizedBody.publicToken,
      });

      // Store connection info with user context
      await state.set('plaid-connections', result.itemId, {
        userId: req.auth.userId,
        itemId: result.itemId,
        institution: sanitizedBody.institution,
        connectedAt: new Date().toISOString(),
        connectedBy: req.auth.email || 'unknown',
      });

      await emit({
        topic: 'plaid.token.exchanged',
        data: {
          userId: req.auth.userId,
          itemId: result.itemId,
          traceId,
        },
      });

      // Trigger account sync
      await plaidTool.execute({
        action: 'syncAccounts',
        userId: req.auth.userId,
      });

      await emit({
        topic: 'plaid.accounts.connected',
        data: {
          userId: req.auth.userId,
          itemId: result.itemId,
          accountCount: sanitizedBody.accounts?.length || 0,
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
      logger.error('Failed to exchange Plaid token', { 
        error: error.message, 
        userId: req.auth.userId,
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
  },
  {
    rateLimit: { limit: 20, windowMs: 60000 }, // 20 requests per minute
    resource: 'plaid',
    action: 'exchange',
  }
);