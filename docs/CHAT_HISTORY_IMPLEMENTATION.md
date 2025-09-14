# Chat History Implementation

## Overview
This implementation provides persistent chat history with unique URLs for each chat session, thread support, and a comprehensive UI for managing conversations.

## Architecture

### Database Schema (Supabase PostgreSQL)
- **chat_sessions**: Main chat containers with unique IDs
- **chat_messages**: Individual messages within chats
- **chat_metadata**: Aggregated stats and tags
- **chat_shares**: Sharing functionality for chats

### Backend (Motia Steps)
- `CreateChatSession`: Creates new chat with unique ID
- `GetChatHistory`: Lists all user's chat sessions
- `GetChatMessages`: Retrieves messages for specific chat
- `SaveChatMessage`: Persists messages to database
- `ChatWithAgent`: Updated to support session IDs

### Frontend Components
- **ChatInterface**: Main chat UI component
- **ChatHistorySidebar**: Lists previous chats with preview
- **useChatSession**: Hook for managing chat sessions
- **useWebSocketChat**: Real-time streaming support

## Features

### Chat Sessions
- Unique URL for each chat: `/chat/{sessionId}`
- Automatic session creation on first message
- Session persistence across page reloads
- Chat title auto-generated from first message

### Thread Support
- Messages can be grouped into threads
- Parent-child message relationships
- Thread IDs for conversation branches

### Chat Management
- Archive/unarchive chats
- Delete chat sessions
- Search across chat history
- Export chat history (future feature)

### Real-time Updates
- WebSocket integration for streaming responses
- Live status updates during processing
- Fallback to polling if WebSocket unavailable

## URL Structure
- `/chat` - Creates new chat session
- `/chat/{sessionId}` - Specific chat session
- `/chat/{sessionId}/thread/{threadId}` - Thread view (future)

## API Endpoints

### Create Chat Session
```
POST /api/chat/sessions
Body: {
  userId: string,
  assistantType: string,
  initialMessage?: string
}
Response: {
  sessionId: string,
  url: string,
  chatSession: object
}
```

### Get Chat History
```
GET /api/chat/sessions?userId={userId}&limit=20&offset=0&archived=false
Response: {
  sessions: ChatSession[],
  total: number,
  limit: number,
  offset: number
}
```

### Get Chat Messages
```
GET /api/chat/sessions/{sessionId}/messages?threadId={threadId}&limit=50&offset=0
Response: {
  session: ChatSession,
  messages: ChatMessage[],
  threads: Thread[],
  total: number,
  limit: number,
  offset: number
}
```

### Save Chat Message
```
POST /api/chat/sessions/{sessionId}/messages
Body: {
  role: 'user' | 'assistant' | 'system',
  content: string,
  threadId?: string,
  parentMessageId?: string,
  metadata?: object
}
Response: {
  message: ChatMessage,
  threadId?: string
}
```

## Usage Example

```typescript
// Creating a new chat session
const { sessionId, url } = await chatHistoryService.createSession(
  userId,
  'general',
  'Hello, how are you?'
);

// Loading chat history
const { sessions } = await chatHistoryService.getChatHistory(userId, {
  limit: 20,
  archived: false
});

// Saving a message
await chatHistoryService.saveMessage(sessionId, {
  role: 'user',
  content: 'What is the weather today?',
  metadata: { timestamp: new Date() }
});
```

## Security
- Row Level Security (RLS) policies ensure users can only access their own chats
- Session validation on all API endpoints
- Secure token generation for chat sharing

## Migration
To apply the database schema:
```bash
# Run the migration in Supabase
supabase migration up 003_chat_history
```

## Environment Variables
Ensure these are set in your `.env`:
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

## Future Enhancements
- Chat export (PDF, JSON, Markdown)
- Advanced search with filters
- Chat templates
- Collaborative chats
- Voice message support
- Rich media attachments