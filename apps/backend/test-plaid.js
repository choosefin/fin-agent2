const { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } = require('plaid');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('Testing Plaid credentials...');
console.log('Environment:', process.env.PLAID_ENV);
console.log('Client ID:', process.env.PLAID_CLIENT_ID);
console.log('Secret configured:', !!process.env.PLAID_SECRET);

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function testLinkTokenCreation() {
  try {
    const response = await plaidClient.linkTokenCreate({
      client_name: 'Fin Agent Test',
      country_codes: [CountryCode.Us],
      language: 'en',
      user: {
        client_user_id: 'test-user-' + Date.now(),
      },
      products: [Products.Auth, Products.Transactions],
    });
    
    console.log('✅ Link token created successfully!');
    console.log('Token:', response.data.link_token);
    console.log('Expiration:', response.data.expiration);
  } catch (error) {
    console.error('❌ Error creating link token:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
  }
}

testLinkTokenCreation();