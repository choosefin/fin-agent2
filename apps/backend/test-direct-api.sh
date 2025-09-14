#!/bin/bash

echo "Testing TradingView Chart Detection in Stream Endpoint"
echo "======================================================="
echo ""

echo "Test 1: Show me AAPL chart"
echo "--------------------------"
curl -s -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Show me AAPL chart","assistantType":"general","userId":"test-123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print('Has Chart:', data.get('hasChart', False)); print('Symbol:', data.get('symbol', 'None')); print('Response preview:', data.get('response', '')[:100])"

echo ""
echo "Test 2: Display Tesla stock chart"
echo "----------------------------------"
curl -s -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Display Tesla stock chart","assistantType":"general","userId":"test-123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print('Has Chart:', data.get('hasChart', False)); print('Symbol:', data.get('symbol', 'None'))"

echo ""
echo "Test 3: What is AAPL doing (no 'chart' keyword)"
echo "-----------------------------------------------"
curl -s -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"What is AAPL doing","assistantType":"general","userId":"test-123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print('Has Chart:', data.get('hasChart', False)); print('Should NOT have chart')"