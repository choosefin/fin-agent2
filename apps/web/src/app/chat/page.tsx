'use client';

import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { chatHistoryService } from '../../lib/chat-history.service';

export default function ChatPage() {
  const [creating, setCreating] = useState(false);
  const userId = 'user-123'; // TODO: Get from auth context

  useEffect(() => {
    // Automatically create a new chat session when landing on /chat
    const createNewChat = async () => {
      if (creating) return;
      setCreating(true);
      
      try {
        const response = await chatHistoryService.createSession(userId);
        // Redirect to the new chat session
        window.location.href = `/chat/${response.sessionId}`;
      } catch (error) {
        console.error('Failed to create chat session:', error);
        setCreating(false);
      }
    };

    createNewChat();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Creating new chat...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
}