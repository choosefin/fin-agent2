'use client';

import { useState } from 'react';

export default function TestChatPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendMessage = async () => {
    setLoading(true);
    setError('');
    setResponse('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          assistantType: 'general',
          userId: 'test-user-' + Date.now(),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Chat API</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Message:</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter your message"
          />
        </div>
        
        <button
          onClick={sendMessage}
          disabled={loading || !message}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded">
            Error: {error}
          </div>
        )}
        
        {response && (
          <div className="p-4 bg-green-100 rounded">
            <h3 className="font-semibold mb-2">Response:</h3>
            <pre className="whitespace-pre-wrap text-sm">{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}