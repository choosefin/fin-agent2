# Frontend TradingView Chart Integration Guide

## Problem
The backend is returning chart HTML in the response, but it's not rendering in the UI.

## Solution Options

### Option 1: Using the Iframe (Most Reliable)
The backend now returns a `chartIframe` field which is a simple iframe embed:

```jsx
const ChatMessage = ({ message }) => {
  return (
    <div>
      <p>{message.response}</p>
      {message.hasChart && message.chartIframe && (
        <div dangerouslySetInnerHTML={{ __html: message.chartIframe }} />
      )}
    </div>
  );
};
```

### Option 2: Rendering the Chart HTML with Script Execution
React doesn't execute scripts in `dangerouslySetInnerHTML`. You need to manually execute them:

```jsx
import React, { useEffect, useRef } from 'react';

const TradingViewChart = ({ html }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !html) return;

    // Set HTML
    containerRef.current.innerHTML = html;

    // Execute scripts
    const scripts = containerRef.current.getElementsByTagName('script');
    Array.from(scripts).forEach(oldScript => {
      const newScript = document.createElement('script');
      
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return <div ref={containerRef} />;
};

// Usage
{message.hasChart && message.chartHtml && (
  <TradingViewChart html={message.chartHtml} />
)}
```

### Option 3: Using Chart Config (Custom Implementation)
The backend also returns `chartConfig` with the chart parameters:

```jsx
const TradingViewWidget = ({ config }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.TradingView || !config) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      new window.TradingView.widget({
        ...config,
        container_id: containerRef.current.id,
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [config]);

  return <div id={config.containerId} ref={containerRef} style={{ height: 500 }} />;
};
```

## Common Issues and Solutions

### 1. Content Security Policy (CSP)
Add to your HTML or configure your server to include:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' https://*.tradingview.com; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tradingview.com; 
               frame-src 'self' https://*.tradingview.com;">
```

Or in Next.js `next.config.js`:
```js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://*.tradingview.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tradingview.com"
          }
        ]
      }
    ]
  }
}
```

### 2. Container Dimensions
Ensure the container has explicit dimensions:

```css
.chart-container {
  width: 100%;
  min-height: 500px;
  position: relative;
}
```

### 3. Testing
Use the test page to verify charts work in isolation:
```bash
open apps/backend/test-chart-render.html
```

## Response Structure
The backend returns:

```json
{
  "traceId": "...",
  "response": "Here's the interactive chart for AAPL:",
  "hasChart": true,
  "symbol": "AAPL",
  "chartHtml": "<div class='tradingview-chart-wrapper'>...</div>",
  "chartIframe": "<iframe src='https://s.tradingview.com/...' />",
  "chartConfig": {
    "symbol": "AAPL",
    "containerId": "tradingview_aapl_1234567890",
    "height": 500,
    "width": "100%",
    "interval": "1D"
  }
}
```

## Quick Debug Checklist

1. **Check browser console** for errors
2. **Verify response** has `hasChart: true` and `chartHtml` or `chartIframe`
3. **Test iframe option** first (most reliable)
4. **Check CSP headers** in Network tab
5. **Ensure container has dimensions** (not height: 0)
6. **Try test page** to isolate issues

## Example Full Implementation

```jsx
import React, { useState, useEffect, useRef } from 'react';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (text) => {
    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        assistantType: 'general',
        userId: 'user-123'
      })
    });
    
    const data = await response.json();
    setMessages(prev => [...prev, data]);
  };

  return (
    <div className="chat">
      {messages.map(msg => (
        <div key={msg.traceId} className="message">
          <p>{msg.response}</p>
          
          {/* Option 1: Iframe (simplest) */}
          {msg.hasChart && msg.chartIframe && (
            <div 
              className="chart-container"
              dangerouslySetInnerHTML={{ __html: msg.chartIframe }}
            />
          )}
          
          {/* Option 2: Chart HTML with script execution */}
          {msg.hasChart && msg.chartHtml && !msg.chartIframe && (
            <ChartRenderer html={msg.chartHtml} />
          )}
        </div>
      ))}
    </div>
  );
};

const ChartRenderer = ({ html }) => {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    ref.current.innerHTML = html;
    
    // Execute scripts
    const scripts = ref.current.querySelectorAll('script');
    scripts.forEach(script => {
      const newScript = document.createElement('script');
      newScript.textContent = script.textContent;
      if (script.src) newScript.src = script.src;
      script.parentNode.replaceChild(newScript, script);
    });
  }, [html]);
  
  return <div ref={ref} className="tradingview-chart" />;
};
```