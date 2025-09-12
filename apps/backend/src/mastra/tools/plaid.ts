import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';
import { supabase } from '../config';
import { encryptionService } from '../../../services/encryption.service';
import { secretsService } from '../../../services/secrets.service';
import { authService } from '../../../services/auth.service';

// Initialize Plaid client with secure secret management
let plaidClient: PlaidApi;

async function initializePlaidClient() {
  const plaidSecret = await secretsService.getSecret('PLAID_SECRET');
  const plaidClientId = process.env.PLAID_CLIENT_ID;
  
  if (!plaidSecret || !plaidClientId) {
    throw new Error('Plaid credentials not configured');
  }
  
  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
    },
  });
  
  plaidClient = new PlaidApi(configuration);
}

// Initialize on first use
initializePlaidClient().catch(console.error);

// Token encryption helpers using the secure encryption service
async function encryptToken(token: string): Promise<string> {
  const encryptedData = await encryptionService.encrypt(token);
  return JSON.stringify(encryptedData);
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const encryptedData = JSON.parse(encryptedToken);
  return await encryptionService.decrypt(encryptedData);
}

// Plaid Integration Tool
export const plaidTool = createTool({
  id: 'plaid-integration',
  description: 'Connect and sync bank/brokerage accounts via Plaid',
  inputSchema: z.object({
    action: z.enum([
      'createLinkToken',
      'exchangeToken',
      'syncAccounts',
      'getAccounts',
      'getTransactions',
      'getHoldings',
      'refreshAccounts',
    ]),
    userId: z.string(),
    publicToken: z.string().optional(),
    accessToken: z.string().optional(),
    accountId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  execute: async ({ action, userId, publicToken, accessToken, startDate, endDate }) => {
    switch (action) {
      case 'createLinkToken':
        // Create a link token for Plaid Link initialization
        const linkTokenResponse = await plaidClient.linkTokenCreate({
          client_name: 'Fin Agent',
          country_codes: ['US'],
          language: 'en',
          user: {
            client_user_id: userId,
          },
          products: ['accounts', 'transactions', 'investments'],
          account_filters: {
            depository: {
              account_subtypes: ['checking', 'savings'],
            },
            investment: {
              account_subtypes: ['all'],
            },
          },
        });
        
        return {
          linkToken: linkTokenResponse.data.link_token,
          expiration: linkTokenResponse.data.expiration,
        };

      case 'exchangeToken':
        if (!publicToken) throw new Error('Public token is required');
        
        // Exchange public token for access token
        const exchangeResponse = await plaidClient.itemPublicTokenExchange({
          public_token: publicToken,
        });
        
        const encryptedToken = await encryptToken(exchangeResponse.data.access_token);
        
        // Store encrypted token in database
        const { error: insertError } = await supabase
          .from('plaid_items')
          .insert({
            user_id: userId,
            plaid_item_id: exchangeResponse.data.item_id,
            access_token_encrypted: encryptedToken,
            status: 'active',
          });
        
        if (insertError) throw insertError;
        
        return {
          itemId: exchangeResponse.data.item_id,
          success: true,
        };

      case 'syncAccounts':
        if (!accessToken) {
          // Fetch from database if not provided
          const { data: items } = await supabase
            .from('plaid_items')
            .select('access_token_encrypted')
            .eq('user_id', userId)
            .eq('status', 'active');
          
          if (!items || items.length === 0) {
            throw new Error('No active Plaid items found');
          }
          
          accessToken = await decryptToken(items[0].access_token_encrypted);
        }
        
        // Sync accounts
        const accountsResponse = await plaidClient.accountsGet({
          access_token: accessToken,
        });
        
        // Store accounts in database
        for (const account of accountsResponse.data.accounts) {
          await supabase
            .from('plaid_accounts')
            .upsert({
              plaid_account_id: account.account_id,
              plaid_item_id: accountsResponse.data.item.item_id,
              account_name: account.name,
              account_type: account.type,
              account_subtype: account.subtype,
              balance_available: account.balances.available,
              balance_current: account.balances.current,
              balance_limit: account.balances.limit,
              iso_currency_code: account.balances.iso_currency_code,
              last_synced_at: new Date().toISOString(),
            });
        }
        
        return {
          accounts: accountsResponse.data.accounts,
          syncedAt: new Date().toISOString(),
        };

      case 'getAccounts':
        const { data: accounts } = await supabase
          .from('plaid_accounts')
          .select('*')
          .eq('user_id', userId);
        
        return { accounts };

      case 'getTransactions':
        if (!accessToken) {
          const { data: items } = await supabase
            .from('plaid_items')
            .select('access_token_encrypted')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();
          
          if (!items) throw new Error('No active Plaid item found');
          accessToken = await decryptToken(items.access_token_encrypted);
        }
        
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: endDate || new Date().toISOString().split('T')[0],
        });
        
        // Store transactions in database
        for (const transaction of transactionsResponse.data.transactions) {
          await supabase
            .from('plaid_transactions')
            .upsert({
              plaid_transaction_id: transaction.transaction_id,
              plaid_account_id: transaction.account_id,
              amount: transaction.amount,
              date: transaction.date,
              name: transaction.name,
              merchant_name: transaction.merchant_name,
              category: transaction.category,
              pending: transaction.pending,
            });
        }
        
        return {
          transactions: transactionsResponse.data.transactions,
          total: transactionsResponse.data.total_transactions,
        };

      case 'getHoldings':
        if (!accessToken) {
          const { data: items } = await supabase
            .from('plaid_items')
            .select('access_token_encrypted')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();
          
          if (!items) throw new Error('No active Plaid item found');
          accessToken = await decryptToken(items.access_token_encrypted);
        }
        
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: accessToken,
        });
        
        // Store holdings in database
        for (const holding of holdingsResponse.data.holdings) {
          await supabase
            .from('plaid_holdings')
            .upsert({
              plaid_holding_id: `${holding.account_id}_${holding.security_id}`,
              plaid_account_id: holding.account_id,
              security_id: holding.security_id,
              quantity: holding.quantity,
              cost_basis: holding.cost_basis,
              value: holding.quantity * (holdingsResponse.data.securities.find(
                s => s.security_id === holding.security_id
              )?.close_price || 0),
              iso_currency_code: holding.iso_currency_code,
              last_synced_at: new Date().toISOString(),
            });
        }
        
        return {
          holdings: holdingsResponse.data.holdings,
          securities: holdingsResponse.data.securities,
          accounts: holdingsResponse.data.accounts,
        };

      case 'refreshAccounts':
        const { data: items } = await supabase
          .from('plaid_items')
          .select('access_token_encrypted, plaid_item_id')
          .eq('user_id', userId)
          .eq('status', 'active');
        
        if (!items || items.length === 0) {
          throw new Error('No active Plaid items found');
        }
        
        const refreshResults = [];
        
        for (const item of items) {
          const token = await decryptToken(item.access_token_encrypted);
          
          // Refresh accounts
          const accountsRes = await plaidClient.accountsBalanceGet({
            access_token: token,
          });
          
          // Update balances in database
          for (const account of accountsRes.data.accounts) {
            await supabase
              .from('plaid_accounts')
              .update({
                balance_available: account.balances.available,
                balance_current: account.balances.current,
                balance_limit: account.balances.limit,
                last_synced_at: new Date().toISOString(),
              })
              .eq('plaid_account_id', account.account_id);
          }
          
          refreshResults.push({
            itemId: item.plaid_item_id,
            accounts: accountsRes.data.accounts.length,
            refreshedAt: new Date().toISOString(),
          });
        }
        
        return { refreshResults };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
});