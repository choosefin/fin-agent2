import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ChatSession, 
  ChatMessage,
  chatHistoryService 
} from '../lib/chat-history.service';

export interface UseChatSessionOptions {
  userId: string;
  autoCreateSession?: boolean;
  assistantType?: string;
}

export function useChatSession(options: UseChatSessionOptions) {
  const { userId, autoCreateSession = true, assistantType = 'general' } = options;
  const router = useRouter();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingMessage, setSavingMessage] = useState(false);
  
  const sessionIdRef = useRef<string | null>(null);

  // Load session from URL parameter
  useEffect(() => {
    if (urlSessionId) {
      loadSession(urlSessionId);
    } else if (autoCreateSession && !sessionIdRef.current) {
      createNewSession();
    }
  }, [urlSessionId]);

  // Create a new chat session
  const createNewSession = useCallback(async (initialMessage?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await chatHistoryService.createSession(
        userId,
        assistantType,
        initialMessage
      );
      
      sessionIdRef.current = response.sessionId;
      setCurrentSession(response.chatSession);
      setMessages([]); // Start with empty messages
      
      // Navigate to the new session URL
      router.push(`/chat/${response.sessionId}`);
      
      return response.sessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      console.error('Error creating session:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, assistantType, router.push]);

  // Load an existing session
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await chatHistoryService.getChatMessages(sessionId);
      
      sessionIdRef.current = sessionId;
      setCurrentSession(response.session);
      setMessages(response.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
      console.error('Error loading session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save a message to the current session
  const saveMessage = useCallback(async (
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any,
    threadId?: string,
    parentMessageId?: string
  ) => {
    if (!sessionIdRef.current) {
      // Create a new session if none exists
      const newSessionId = await createNewSession(role === 'user' ? content : undefined);
      if (!newSessionId) {
        throw new Error('Failed to create session for message');
      }
      sessionIdRef.current = newSessionId;
    }

    try {
      setSavingMessage(true);
      
      const response = await chatHistoryService.saveMessage(
        sessionIdRef.current,
        {
          role,
          content,
          metadata,
          threadId,
          parentMessageId,
        }
      );
      
      // Add the new message to the local state
      setMessages(prev => [...prev, response.message]);
      
      return response.message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save message';
      console.error('Error saving message:', err);
      throw new Error(errorMessage);
    } finally {
      setSavingMessage(false);
    }
  }, [createNewSession]);

  // Add a user message and get assistant response
  const sendMessage = useCallback(async (
    content: string,
    onStreamToken?: (token: string) => void,
    onComplete?: (response: string) => void
  ) => {
    try {
      // Save user message
      await saveMessage('user', content);
      
      // Send to chat API with session ID
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          assistantType: currentSession?.assistant_type || assistantType,
          userId,
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get assistant response');
      }

      const data = await response.json();
      
      // Save assistant response
      await saveMessage(
        'assistant',
        data.response,
        {
          provider: data.llmProvider,
          model: data.model,
          assistantType: data.assistantType,
        }
      );
      
      if (onComplete) {
        onComplete(data.response);
      }
      
      return data.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [userId, assistantType, currentSession, saveMessage]);

  // Switch to a different session
  const switchSession = useCallback((session: ChatSession) => {
    router.push(`/chat/${session.id}`);
  }, [router.push]);

  // Clear current session and start new
  const clearSession = useCallback(() => {
    sessionIdRef.current = null;
    setCurrentSession(null);
    setMessages([]);
    setError(null);
    router.push('/chat');
  }, [router.push]);

  // Archive the current session
  const archiveSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    
    try {
      await chatHistoryService.updateSessionArchiveStatus(sessionIdRef.current, true);
      if (currentSession) {
        setCurrentSession({ ...currentSession, is_archived: true });
      }
    } catch (err) {
      console.error('Error archiving session:', err);
      throw err;
    }
  }, [currentSession]);

  // Delete the current session
  const deleteSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    
    try {
      await chatHistoryService.deleteSession(sessionIdRef.current);
      clearSession();
    } catch (err) {
      console.error('Error deleting session:', err);
      throw err;
    }
  }, [clearSession]);

  return {
    // State
    currentSession,
    sessionId: sessionIdRef.current,
    messages,
    loading,
    error,
    savingMessage,
    
    // Actions
    createNewSession,
    loadSession,
    saveMessage,
    sendMessage,
    switchSession,
    clearSession,
    archiveSession,
    deleteSession,
  };
}