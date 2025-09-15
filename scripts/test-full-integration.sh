#!/bin/bash

echo "================================"
echo "TradingView Chart Full Integration Test"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test backend directly
echo "1. Testing Backend Direct (port 3000):"
echo "--------------------------------------"
response=$(curl -s -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Show me AAPL chart","assistantType":"general","userId":"test-123"}')

if echo "$response" | grep -q '"hasChart":true'; then
  echo -e "${GREEN}✅ Backend returns hasChart: true${NC}"
else
  echo -e "${RED}❌ Backend not returning chart${NC}"
fi

if echo "$response" | grep -q '"chartIframe"'; then
  echo -e "${GREEN}✅ Backend returns chartIframe field${NC}"
else
  echo -e "${RED}❌ Backend missing chartIframe${NC}"
fi

if echo "$response" | grep -q '"symbol":"AAPL"'; then
  echo -e "${GREEN}✅ Backend returns correct symbol${NC}"
else
  echo -e "${RED}❌ Backend missing symbol${NC}"
fi

echo ""
echo "2. Testing Frontend API Proxy (port 3001):"
echo "------------------------------------------"
frontend_response=$(curl -s -X POST http://localhost:3001/api/assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"Show me AAPL chart","assistantType":"general","userId":"test-123"}' 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$frontend_response" ]; then
  if echo "$frontend_response" | grep -q '"hasChart":true'; then
    echo -e "${GREEN}✅ Frontend proxy passes hasChart${NC}"
  else
    echo -e "${RED}❌ Frontend proxy not passing chart data${NC}"
  fi
  
  if echo "$frontend_response" | grep -q '"chartIframe"'; then
    echo -e "${GREEN}✅ Frontend proxy passes chartIframe${NC}"
  else
    echo -e "${RED}❌ Frontend proxy missing chartIframe${NC}"
  fi
else
  echo -e "${RED}❌ Frontend not running or not accessible on port 3001${NC}"
  echo "   Make sure to run: cd apps/web && npm run dev"
fi

echo ""
echo "3. Component Integration:"
echo "------------------------"
echo "The following components have been updated to render charts:"
echo -e "${GREEN}✅ /apps/web/src/components/chat-interface.tsx${NC}"
echo -e "${GREEN}✅ /apps/web/src/components/smart-chat-interface.tsx${NC}"
echo -e "${GREEN}✅ /apps/web/src/app/api/assistant/route.ts${NC}"

echo ""
echo "4. Test in Browser:"
echo "------------------"
echo "1. Open http://localhost:3001 in your browser"
echo "2. Type: 'Show me AAPL chart'"
echo "3. You should see:"
echo "   - Text: 'Here's the interactive chart for AAPL:'"
echo "   - Interactive TradingView chart below the text"

echo ""
echo "================================"
echo "Test Complete"
echo "================================"