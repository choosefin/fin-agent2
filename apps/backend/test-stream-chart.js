#!/usr/bin/env node

const testStreamEndpoint = async () => {
  const API_BASE = 'http://localhost:3000';
  
  const testCases = [
    {
      name: 'Direct AAPL chart request',
      message: 'Show me AAPL chart',
      expectedSymbol: 'AAPL',
    },
    {
      name: 'Tesla chart request',
      message: 'Display TSLA chart',
      expectedSymbol: 'TSLA',
    },
    {
      name: 'Bitcoin chart request',
      message: 'Show me Bitcoin chart',
      expectedSymbol: 'BTCUSD',
    },
    {
      name: 'Natural language Apple request',
      message: 'Can you show me the Apple stock chart?',
      expectedSymbol: 'AAPL',
    },
  ];

  console.log('🚀 Testing TradingView Chart Integration in Stream Endpoint\n');
  console.log('=' .repeat(60));

  for (const test of testCases) {
    console.log(`\n📊 Test: ${test.name}`);
    console.log(`   Message: "${test.message}"`);
    
    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: test.message,
          assistantType: 'general',
          userId: 'test-user-123',
        }),
      });

      if (!response.ok) {
        console.error(`   ❌ HTTP Error: ${response.status}`);
        const errorText = await response.text();
        console.error(`   Error: ${errorText}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`   Response fields:`);
      console.log(`   - traceId: ${data.traceId}`);
      console.log(`   - llmProvider: ${data.llmProvider}`);
      console.log(`   - model: ${data.model}`);
      console.log(`   - hasChart: ${data.hasChart}`);
      console.log(`   - symbol: ${data.symbol || 'N/A'}`);
      
      // Check if chart was generated
      if (data.hasChart && data.chartHtml) {
        console.log(`   ✅ Chart HTML generated (${data.chartHtml.length} chars)`);
        console.log(`   ✅ Symbol detected: ${data.symbol}`);
        
        // Verify it contains TradingView widget code
        if (data.chartHtml.includes('TradingView.widget')) {
          console.log(`   ✅ TradingView widget code present`);
        }
        
        if (data.symbol === test.expectedSymbol) {
          console.log(`   ✅ Correct symbol extracted`);
        } else {
          console.log(`   ⚠️  Symbol mismatch: Expected ${test.expectedSymbol}, got ${data.symbol}`);
        }
        
        // Check response message
        if (data.response.includes('chart')) {
          console.log(`   ✅ Response mentions chart`);
        }
      } else {
        console.log(`   ❌ No chart generated`);
        console.log(`   Response preview: ${data.response?.substring(0, 150)}...`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Stream endpoint test completed\n');
};

// Test regular endpoint for comparison
const testRegularEndpoint = async () => {
  const API_BASE = 'http://localhost:3000';
  
  console.log('\n🔄 Testing Regular Chat Endpoint for Comparison\n');
  console.log('=' .repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Show me AAPL chart',
        assistantType: 'general',
        userId: 'test-user-123',
      }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      return;
    }

    const data = await response.json();
    
    console.log('Regular endpoint response:');
    console.log(`- hasChart: ${data.hasChart}`);
    console.log(`- symbol: ${data.symbol || 'N/A'}`);
    console.log(`- chartHtml present: ${!!data.chartHtml}`);
    console.log(`- llmProvider: ${data.llmProvider}`);
    console.log(`- model: ${data.model}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
};

// Run tests
(async () => {
  console.log('🎯 Starting TradingView Stream Integration Tests...\n');
  
  // Test stream endpoint
  await testStreamEndpoint();
  
  // Test regular endpoint for comparison
  await testRegularEndpoint();
  
  console.log('\n🏁 All tests completed!');
  console.log('\nNote: Make sure the Motia dev server is running:');
  console.log('  cd /root/repo/apps/backend && npm run dev\n');
})();