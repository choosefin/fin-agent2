// Frontend Integration Example for TradingView Charts
// This shows how to properly render the chart HTML in your React frontend

import React, { useEffect, useRef } from 'react';

interface ChatMessage {
  traceId: string;
  response: string;
  chartHtml?: string;
  symbol?: string;
  hasChart?: boolean;
  llmProvider: string;
  model: string;
}

// Component to render TradingView chart
const TradingViewChart: React.FC<{ html: string }> = ({ html }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !html) return;

    // Set the HTML content
    containerRef.current.innerHTML = html;

    // Execute any script tags in the HTML
    const scripts = containerRef.current.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const newScript = document.createElement('script');
      
      // Copy attributes
      Array.from(script.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      // Copy content or src
      if (script.src) {
        newScript.src = script.src;
      } else {
        newScript.textContent = script.textContent;
      }
      
      // Replace old script with new one to trigger execution
      script.parentNode?.replaceChild(newScript, script);
    }
  }, [html]);

  return <div ref={containerRef} />;
};

// Main chat component
const ChatComponent: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const sendMessage = async (message: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          assistantType: 'general',
          userId: 'user-123',
        }),
      });

      const data: ChatMessage = await response.json();
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.traceId} className="message">
            {/* Text response */}
            <div className="text-response">
              {msg.response}
            </div>
            
            {/* Render chart if present */}
            {msg.hasChart && msg.chartHtml && (
              <TradingViewChart html={msg.chartHtml} />
            )}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendMessage(input);
              setInput('');
            }
          }}
          placeholder="Try: Show me AAPL chart"
        />
      </div>
    </div>
  );
};

// Alternative: Simple HTML injection method
const SimpleChartRenderer: React.FC<{ chartHtml: string }> = ({ chartHtml }) => {
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: chartHtml }}
      style={{ width: '100%', minHeight: '500px' }}
    />
  );
};

// IMPORTANT: If charts still don't appear, check these issues:

/*
1. Content Security Policy (CSP)
   - Make sure your CSP allows scripts from tradingview.com:
   - Add to your HTML head or meta tags:
   
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self' https://s3.tradingview.com https://www.tradingview.com; 
                  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://www.tradingview.com;
                  frame-src 'self' https://www.tradingview.com;">

2. Script Execution
   - React doesn't execute scripts in dangerouslySetInnerHTML
   - Use the TradingViewChart component above that manually executes scripts

3. Container Dimensions
   - Ensure the container has proper width/height
   - TradingView needs explicit dimensions to render

4. CORS Issues
   - If hosting on different domain, ensure CORS headers are set

5. Debug in Browser Console
   - Check for errors in the browser console
   - Look for TradingView loading errors
*/

export { ChatComponent, TradingViewChart, SimpleChartRenderer };