// Test Azure OpenAI configuration
require('dotenv').config({ path: '.env.local' });

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;

console.log('Azure OpenAI Configuration:');
console.log('Endpoint:', endpoint ? 'Configured' : 'Not configured');
console.log('API Key:', apiKey ? 'Configured' : 'Not configured');
console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'model-router');

async function testAzureOpenAI() {
  if (!endpoint || !apiKey) {
    console.log('\n❌ Azure OpenAI not configured');
    return;
  }

  console.log('\n🔧 Testing Azure OpenAI connection...');
  
  try {
    const { OpenAI } = require('openai');
    
    // Extract base URL
    const baseURL = endpoint.split('/openai')[0];
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    
    const client = new OpenAI({
      apiKey,
      baseURL: `${baseURL}/openai`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Making test request to Azure OpenAI...');
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'model-router',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Azure OpenAI is working!" in exactly 5 words.' }
      ],
      temperature: 0.7,
      max_tokens: 50,
    });
    
    console.log('\n✅ Azure OpenAI Response:', response.choices[0]?.message?.content);
    console.log('Model used:', response.model);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('\n❌ Azure OpenAI Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAzureOpenAI();