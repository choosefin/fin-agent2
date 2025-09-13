import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function createLinkToken(userId: string) {
  try {
    console.log('Creating link token for user:', userId);
    console.log('Plaid environment:', process.env.PLAID_ENV || 'sandbox');
    console.log('Client ID configured:', !!process.env.PLAID_CLIENT_ID);
    console.log('Secret configured:', !!process.env.PLAID_SECRET);
    
    // Only use mock if credentials are explicitly not configured
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.log('Warning: Plaid credentials not configured, using mock response');
      return {
        link_token: `link-sandbox-mock-${Date.now()}-${userId}`,
        expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      };
    }
    
    const response = await plaidClient.linkTokenCreate({
      client_name: 'Fin Agent',
      country_codes: [CountryCode.Us],
      language: 'en',
      user: {
        client_user_id: userId,
      },
      products: [Products.Auth, Products.Transactions],
      redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
    });
    
    return {
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error: any) {
    console.error('Error creating link token:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
}

export async function exchangePublicToken(publicToken: string) {
  try {
    // Only use mock if credentials are explicitly not configured
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.log('Warning: Plaid credentials not configured, using mock exchange response');
      return {
        access_token: `access-sandbox-mock-${Date.now()}`,
        item_id: `item-mock-${Date.now()}`,
      };
    }
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    
    return {
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    };
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw error;
  }
}

export async function getAccounts(accessToken: string) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
}

export async function getTransactions(accessToken: string, startDate?: string, endDate?: string) {
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: endDate || new Date().toISOString().split('T')[0],
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}