'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatInterface } from '../../../components/ChatInterface/ChatInterface';
import { chatHistoryService } from '../../../lib/chat-history.service';

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const userId = 'user-123'; // TODO: Get from auth context

  useEffect(() => {
    // Verify the session exists
    const verifySession = async () => {
      try {
        const response = await chatHistoryService.getChatMessages(sessionId);
        setValidSession(true);
      } catch (error) {
        console.error('Invalid session:', error);
        setValidSession(false);
      }
    };

    if (sessionId) {
      verifySession();
    }
  }, [sessionId]);

  if (validSession === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Loading chat...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (validSession === false) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-red-600">Chat session not found</h2>
          <p className="text-gray-600 mb-4">The chat session you're looking for doesn't exist.</p>
          <a href="/chat" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Start New Chat
          </a>
        </div>
      </div>
    );
  }

  return <ChatInterface userId={userId} sessionId={sessionId} />;
}