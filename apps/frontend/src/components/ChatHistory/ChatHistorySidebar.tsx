import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  ChatSession, 
  chatHistoryService 
} from '../../services/chat-history.service';
import './ChatHistorySidebar.css';

interface ChatHistorySidebarProps {
  userId: string;
  currentSessionId?: string;
  onSessionSelect: (session: ChatSession) => void;
  onNewChat: () => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  userId,
  currentSessionId,
  onSessionSelect,
  onNewChat,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, [userId, showArchived]);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatHistoryService.getChatHistory(userId, {
        archived: showArchived,
        limit: 50,
      });
      setSessions(response.sessions);
    } catch (err) {
      setError('Failed to load chat history');
      console.error('Error loading chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        await chatHistoryService.deleteSession(sessionId);
        setSessions(sessions.filter(s => s.id !== sessionId));
      } catch (err) {
        console.error('Error deleting session:', err);
        alert('Failed to delete chat session');
      }
    }
  };

  const handleArchiveSession = async (sessionId: string, isArchived: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatHistoryService.updateSessionArchiveStatus(sessionId, !isArchived);
      await loadChatHistory();
    } catch (err) {
      console.error('Error archiving session:', err);
      alert('Failed to archive chat session');
    }
  };

  const getAssistantIcon = (type: string) => {
    const icons: Record<string, string> = {
      general: '🤖',
      analyst: '📊',
      trader: '📈',
      advisor: '💡',
      riskManager: '⚠️',
      economist: '🏦',
    };
    return icons[type] || '🤖';
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="chat-history-sidebar">
      <div className="sidebar-header">
        <h3>Chat History</h3>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>

      <div className="sidebar-controls">
        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived
        </label>
      </div>

      {loading && (
        <div className="sidebar-loading">
          Loading chat history...
        </div>
      )}

      {error && (
        <div className="sidebar-error">
          {error}
          <button onClick={loadChatHistory}>Retry</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="sidebar-empty">
          <p>No chat history yet</p>
          <p className="empty-hint">Start a new conversation to begin</p>
        </div>
      )}

      <div className="sessions-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
            onClick={() => onSessionSelect(session)}
          >
            <div className="session-header">
              <span className="assistant-icon">
                {getAssistantIcon(session.assistant_type)}
              </span>
              <span className="session-title">
                {truncateText(session.title || 'New Chat')}
              </span>
            </div>
            
            {session.lastMessage && (
              <div className="session-preview">
                <span className="preview-role">
                  {session.lastMessage.role === 'user' ? 'You' : 'Assistant'}:
                </span>
                <span className="preview-content">
                  {truncateText(session.lastMessage.content, 80)}
                </span>
              </div>
            )}
            
            <div className="session-meta">
              <span className="session-time">
                {formatDistanceToNow(new Date(session.last_message_at), { addSuffix: true })}
              </span>
              {session.chat_metadata && (
                <span className="message-count">
                  {session.chat_metadata.total_messages} messages
                </span>
              )}
            </div>

            <div className="session-actions">
              <button
                className="action-btn archive-btn"
                onClick={(e) => handleArchiveSession(session.id, session.is_archived, e)}
                title={session.is_archived ? 'Unarchive' : 'Archive'}
              >
                {session.is_archived ? '📤' : '📥'}
              </button>
              <button
                className="action-btn delete-btn"
                onClick={(e) => handleDeleteSession(session.id, e)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};