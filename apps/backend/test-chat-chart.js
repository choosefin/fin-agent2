#!/usr/bin/env node

const testChatWithChart = async () => {
  const API_BASE = 'http://localhost:5173';
  
  const testCases = [
    {
      name: 'Direct chart request',
      message: 'Show me AAPL chart',
      expectedSymbol: 'AAPL',
    },
    {
      name: 'Natural language with company name',
      message: 'Can you display the Apple stock chart?',
      expectedSymbol: 'AAPL',
    },
    {
      name: 'Crypto chart request',
      message: 'Show me Bitcoin chart',
      expectedSymbol: 'BTCUSD',
    },
    {
      name: 'Chart with analysis request',
      message: 'Show me TSLA chart and analyze the trend',
      expectedSymbol: 'TSLA',
    },
  ];

  console.log('🧪 Testing TradingView Chart Integration in Chat API\n');
  console.log('=' .repeat(60));

  for (const test of testCases) {
    console.log(`\n📊 Test: ${test.name}`);
    console.log(`   Message: "${test.message}"`);
    
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
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
      
      // Check if chart was detected and generated
      if (data.hasChart && data.chartHtml) {
        console.log(`   ✅ Chart detected for symbol: ${data.symbol || 'N/A'}`);
        console.log(`   ✅ Chart HTML generated (${data.chartHtml.length} chars)`);
        
        if (data.symbol === test.expectedSymbol) {
          console.log(`   ✅ Correct symbol extracted: ${data.symbol}`);
        } else {
          console.log(`   ⚠️  Symbol mismatch: Expected ${test.expectedSymbol}, got ${data.symbol}`);
        }
      } else if (data.response && data.response.toLowerCase().includes('chart')) {
        console.log(`   ⚠️  Response mentions chart but no HTML generated`);
        console.log(`   Response: ${data.response.substring(0, 100)}...`);
      } else {
        console.log(`   ❌ No chart generated`);
        console.log(`   Response: ${data.response?.substring(0, 100)}...`);
      }
      
      console.log(`   LLM Provider: ${data.llmProvider || 'N/A'}`);
      console.log(`   Model: ${data.model || 'N/A'}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Test completed\n');
};

// Test direct TradingView chart endpoint
const testDirectChartEndpoint = async () => {
  const API_BASE = 'http://localhost:5173';
  
  console.log('\n🎯 Testing Direct TradingView Chart Endpoint\n');
  console.log('=' .repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/tradingview-chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: 'AAPL',
        embedType: 'widget',
        theme: 'light',
        height: 500,
      }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      const errorText = await response.text();
      console.error(`Error: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    if (data.success && data.html) {
      console.log('✅ TradingView chart generated successfully');
      console.log(`   Symbol: ${data.symbol}`);
      console.log(`   Embed Type: ${data.embedType}`);
      console.log(`   HTML Length: ${data.html.length} characters`);
    } else {
      console.log('❌ Failed to generate chart');
      console.log(`   Error: ${data.message}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
};

// Run tests
(async () => {
  console.log('Starting TradingView Integration Tests...\n');
  
  // Test chat endpoint with chart detection
  await testChatWithChart();
  
  // Test direct chart endpoint
  await testDirectChartEndpoint();
  
  console.log('\n🏁 All tests completed!');
  console.log('\nNote: Make sure the Motia dev server is running:');
  console.log('  cd /root/repo/apps/backend && npm run dev\n');
})();