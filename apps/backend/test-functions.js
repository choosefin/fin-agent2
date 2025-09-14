#!/usr/bin/env node

// Test the chart detection functions directly
const { extractSymbolFromQuery, isChartRequest } = require('./services/chart.service');

const testMessages = [
  'Show me AAPL chart',
  'Display TSLA stock',
  'Can you show Bitcoin price',
  'What is the market doing',
  'AAPL', // Just symbol, no chart request
  'Show me the chart for Apple',
];

console.log('Testing chart detection functions:\n');
console.log('='.repeat(50));

testMessages.forEach(msg => {
  const symbol = extractSymbolFromQuery(msg);
  const isChart = isChartRequest(msg);
  
  console.log(`\nMessage: "${msg}"`);
  console.log(`  Symbol detected: ${symbol || 'none'}`);
  console.log(`  Is chart request: ${isChart}`);
  console.log(`  Would trigger chart: ${symbol && isChart ? '✅ YES' : '❌ NO'}`);
});

console.log('\n' + '='.repeat(50));
console.log('\nDirect test for "Show me AAPL chart":');
const testMsg = 'Show me AAPL chart';
const sym = extractSymbolFromQuery(testMsg);
const chart = isChartRequest(testMsg);
console.log(`  Symbol: ${sym}`);
console.log(`  Is chart: ${chart}`);
console.log(`  Result: ${sym && chart ? '✅ Should show chart' : '❌ Should NOT show chart'}`);