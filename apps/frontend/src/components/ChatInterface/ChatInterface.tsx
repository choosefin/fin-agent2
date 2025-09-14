import React, { useState, useRef, useEffect } from 'react';
import { ChatHistorySidebar } from '../ChatHistory/ChatHistorySidebar';
import { useChatSession } from '../../hooks/useChatSession';
import { useWebSocketChat } from '../../hooks/useWebSocketChat';
import { ChatSession } from '../../services/chat-history.service';
import './ChatInterface.css';

interface ChatInterfaceProps {
  userId: string;
  defaultAssistantType?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId,
  defaultAssistantType = 'general',
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat session management
  const {
    currentSession,
    sessionId,
    messages,
    loading,
    error,
    savingMessage,
    createNewSession,
    saveMessage,
    switchSession,
    clearSession,
  } = useChatSession({
    userId,
    autoCreateSession: false,
    assistantType: defaultAssistantType,
  });

  // WebSocket for real-time streaming
  const {
    isConnected,
    isStreaming: wsStreaming,
    sendMessage: wsSendMessage,
    messages: wsMessages,
  } = useWebSocketChat({
    autoConnect: true,
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, wsMessages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const messageText = inputMessage;
    setInputMessage('');
    setIsStreaming(true);

    try {
      // Create session if needed and save user message
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createNewSession(messageText);
      } else {
        await saveMessage('user', messageText);
      }

      if (!currentSessionId) {
        throw new Error('Failed to create or get session');
      }

      // Send via WebSocket if connected, otherwise use regular API
      if (isConnected) {
        wsSendMessage(
          messageText,
          currentSession?.assistant_type || defaultAssistantType,
          userId,
          { sessionId: currentSessionId }
        );
        
        // Wait for streaming to complete
        // The WebSocket hook will handle the streaming
      } else {
        // Fallback to regular API call
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            assistantType: currentSession?.assistant_type || defaultAssistantType,
            userId,
            sessionId: currentSessionId,
          }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        const data = await response.json();
        
        // Save assistant response
        await saveMessage('assistant', data.response, {
          provider: data.llmProvider,
          model: data.model,
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    clearSession();
    createNewSession();
  };

  const handleSessionSelect = (session: ChatSession) => {
    switchSession(session);
  };

  const getAssistantLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: 'General Assistant',
      analyst: 'Market Analyst',
      trader: 'Trading Expert',
      advisor: 'Financial Advisor',
      riskManager: 'Risk Manager',
      economist: 'Economic Analyst',
    };
    return labels[type] || 'Assistant';
  };

  // Combine persisted messages with WebSocket streaming messages
  const allMessages = [...messages];
  if (wsStreaming && wsMessages.length > 0) {
    // Add streaming messages that aren't persisted yet
    const lastWsMessage = wsMessages[wsMessages.length - 1];
    if (lastWsMessage.role === 'assistant') {
      allMessages.push({
        id: lastWsMessage.id,
        chat_session_id: sessionId || '',
        role: lastWsMessage.role,
        content: lastWsMessage.content,
        created_at: lastWsMessage.timestamp.toISOString(),
        metadata: lastWsMessage.metadata,
      });
    }
  }

  return (
    <div className="chat-interface">
      <ChatHistorySidebar
        userId={userId}
        currentSessionId={sessionId || undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />
      
      <div className="chat-main">
        <div className="chat-header">
          <h2>{currentSession?.title || 'New Chat'}</h2>
          <div className="chat-meta">
            <span className="assistant-type">
              {getAssistantLabel(currentSession?.assistant_type || defaultAssistantType)}
            </span>
            {isConnected && (
              <span className="connection-status connected">Connected</span>
            )}
          </div>
        </div>

        <div className="messages-container">
          {loading && (
            <div className="loading-message">Loading messages...</div>
          )}
          
          {error && (
            <div className="error-message">
              Error: {error}
            </div>
          )}
          
          {allMessages.length === 0 && !loading && (
            <div className="empty-chat">
              <h3>Start a new conversation</h3>
              <p>Type a message below to begin chatting with your AI assistant.</p>
            </div>
          )}
          
          {allMessages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role}`}
            >
              <div className="message-header">
                <span className="message-role">
                  {message.role === 'user' ? 'You' : getAssistantLabel(message.metadata?.assistantType || currentSession?.assistant_type || defaultAssistantType)}
                </span>
                <span className="message-time">
                  {new Date(message.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.content}
              </div>
              {message.metadata?.provider && (
                <div className="message-metadata">
                  <span className="provider">
                    {message.metadata.provider}
                  </span>
                  {message.metadata.model && (
                    <span className="model">
                      {message.metadata.model}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {(isStreaming || wsStreaming) && (
            <div className="message assistant streaming">
              <div className="message-header">
                <span className="message-role">
                  {getAssistantLabel(currentSession?.assistant_type || defaultAssistantType)}
                </span>
              </div>
              <div className="message-content">
                <span className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isStreaming || savingMessage}
            className="message-input"
            rows={3}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isStreaming || savingMessage}
            className="send-button"
          >
            {isStreaming || savingMessage ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};