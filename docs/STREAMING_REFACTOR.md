# Streaming Refactor: WebSocket to SSE Migration

## Overview

This document describes the refactoring of the chat streaming implementation from the initial WebSocket approach to Server-Sent Events (SSE), based on Motia framework limitations and best practices.

## Background

Initial analysis revealed that while Motia documentation mentions "Streams" for real-time updates, these are WebSocket-based features that aren't directly accessible from API step handlers. Motia API steps must return complete response objects and cannot return `ReadableStream` instances for SSE.

## Solution Architecture

### Backend Implementation

#### 1. **SSE-Based Chat Streaming** (`chat-stream.step.ts`)
- Implements real-time streaming using Server-Sent Events
- Returns a `ReadableStream` with proper SSE headers
- Maintains active stream connections for workflow updates
- Supports both regular chat and multi-agent workflow paths

```typescript
// Key features:
- Stream initialization with SSE headers
- Token-by-token streaming from LLM providers
- Provider fallback with notifications
- Workflow detection and routing
```

#### 2. **Workflow SSE Broadcaster** (`workflow-sse-broadcaster.step.ts`)
- Event handler that listens to workflow events
- Broadcasts updates to active SSE connections
- Maintains connection state for each workflow

#### 3. **LLM Service** (`llm-service.ts`)
- Unified interface for multiple LLM providers (Groq, Azure, OpenAI)
- Streaming callbacks for real-time token delivery
- Automatic provider fallback with notifications
- Priority-based provider selection

### Frontend Implementation

#### 1. **SSE Service** (`sse.service.ts`)
- Manages Server-Sent Events connections
- Handles message parsing and event dispatching
- Simple event emitter pattern (no external dependencies)
- Automatic reconnection is handled per request

#### 2. **React Hook** (`useSSEChat.ts`)
- Stateful chat management with SSE
- Real-time message streaming
- Workflow status tracking
- Error handling and recovery

#### 3. **Chat Interface** (`ChatInterface.tsx`)
- User-friendly chat UI with streaming support
- Assistant type selection
- Workflow progress visualization
- Real-time token rendering

## Key Design Decisions

### Why SSE over WebSockets?

1. **Motia Limitations**: Motia's stream steps aren't fully documented and API steps can return ReadableStreams
2. **Simplicity**: SSE is simpler for unidirectional streaming (server to client)
3. **HTTP/2 Compatibility**: Works well with standard HTTP infrastructure
4. **Auto-reconnection**: Built-in browser support for connection recovery

### Implementation Patterns

1. **Per-Request Connections**: Each chat request creates its own SSE stream
2. **Stateless Streaming**: No persistent WebSocket connection needed
3. **Event-Based Updates**: Clean separation of concerns with event types
4. **Progressive Enhancement**: Falls back to non-streaming for unsupported responses

## API Endpoints

### POST `/api/chat/stream`

Request:
```json
{
  "message": "string",
  "assistantType": "general|analyst|trader|advisor|riskManager|economist",
  "userId": "string",
  "context": {
    "symbols": ["string"],
    "timeframe": "string",
    "riskTolerance": "string"
  }
}
```

Response: `text/event-stream` with SSE messages

Event Types:
- `chat_started`: Streaming session initiated
- `token`: Individual token from LLM
- `provider_switch`: LLM provider changed
- `chat_completed`: Response complete
- `workflow_detected`: Multi-agent workflow triggered
- `workflow_update`: Workflow progress update
- `error`: Error occurred

## Usage Example

```tsx
import { useSSEChat } from '@/hooks/useSSEChat'

function MyChat() {
  const { messages, sendMessage, isStreaming } = useSSEChat()
  
  const handleSend = (text: string) => {
    sendMessage(text, 'analyst', 'user-123')
  }
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

## Migration Path

1. **Remove WebSocket dependencies**: No persistent connections needed
2. **Update frontend hooks**: Switch from `useWebSocketChat` to `useSSEChat`
3. **Configure endpoints**: Ensure `/api/chat/stream` is accessible
4. **Test streaming**: Verify token-by-token delivery works

## Benefits

1. **Simpler Architecture**: No WebSocket server management
2. **Better Compatibility**: Works with standard HTTP infrastructure
3. **Reduced Complexity**: One-way streaming simplifies state management
4. **Framework Alignment**: Works within Motia's constraints
5. **Fallback Support**: Gracefully handles non-streaming responses

## Testing

1. **Basic Chat**: Send message, verify streaming response
2. **Provider Fallback**: Test with missing API keys
3. **Workflow Detection**: Trigger multi-agent analysis
4. **Error Handling**: Test connection failures
5. **Long Responses**: Verify streaming for lengthy content

## Future Enhancements

1. **Message History**: Persist chat history in state
2. **Streaming Metrics**: Track token rate and latency
3. **Enhanced Workflows**: More sophisticated agent coordination
4. **Compression**: Enable gzip for SSE streams
5. **Rate Limiting**: Implement per-user streaming limits