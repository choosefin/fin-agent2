export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  assistant_type: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  url: string;
  lastMessage?: {
    content: string;
    role: string;
    created_at: string;
  };
  chat_metadata?: {
    total_messages: number;
    total_tokens: number;
    providers_used: string[];
    tags: string[];
    last_activity: string;
  };
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thread_id?: string;
  parent_message_id?: string;
  metadata?: {
    provider?: string;
    model?: string;
    tokens?: number;
    assistantType?: string;
    workflowId?: string;
  };
  created_at: string;
}

export interface ChatHistoryResponse {
  sessions: ChatSession[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChatMessagesResponse {
  session: ChatSession;
  messages: ChatMessage[];
  threads: any[];
  total: number;
  limit: number;
  offset: number;
}

export class ChatHistoryService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:5173';
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    assistantType: string = 'general',
    initialMessage?: string
  ): Promise<{ sessionId: string; url: string; chatSession: ChatSession }> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        assistantType,
        initialMessage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create chat session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      archived?: boolean;
    } = {}
  ): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({
      userId,
      limit: (options.limit || 20).toString(),
      offset: (options.offset || 0).toString(),
    });

    if (options.archived !== undefined) {
      params.append('archived', options.archived.toString());
    }

    const response = await fetch(`${this.baseUrl}/api/chat/sessions?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch chat history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get messages for a specific chat session
   */
  async getChatMessages(
    sessionId: string,
    options: {
      threadId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ChatMessagesResponse> {
    const params = new URLSearchParams({
      sessionId,
      limit: (options.limit || 50).toString(),
      offset: (options.offset || 0).toString(),
    });

    if (options.threadId) {
      params.append('threadId', options.threadId);
    }

    const response = await fetch(
      `${this.baseUrl}/api/chat/sessions/messages?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch chat messages: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Save a message to a chat session
   */
  async saveMessage(
    sessionId: string,
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      threadId?: string;
      parentMessageId?: string;
      metadata?: any;
    }
  ): Promise<{ message: ChatMessage; threadId?: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...message, sessionId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Archive or unarchive a chat session
   */
  async updateSessionArchiveStatus(
    sessionId: string,
    isArchived: boolean
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/sessions/${sessionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_archived: isArchived }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update session: ${response.statusText}`);
    }
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/sessions/${sessionId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  /**
   * Search messages across all chat sessions
   */
  async searchMessages(
    userId: string,
    searchQuery: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    const params = new URLSearchParams({
      userId,
      q: searchQuery,
      limit: limit.toString(),
    });

    const response = await fetch(
      `${this.baseUrl}/api/chat/search?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search messages: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const chatHistoryService = new ChatHistoryService();