export interface SSEMessage {
  type: string
  [key: string]: any
}

export interface ChatTokenMessage {
  type: 'token'
  content: string
  metadata?: {
    provider: string
    model: string
  }
}

export interface WorkflowUpdateMessage {
  type: 'workflow_update'
  workflowId: string
  eventType?: string
  stepIndex?: number
  agent?: string
  task?: string
  data?: any
  results?: any
  message?: string
  progress?: number
  timestamp?: string
}

export interface ChatStatusMessage {
  type: 'chat_started' | 'chat_completed' | 'workflow_detected' | 'provider_switch' | 'error'
  [key: string]: any
}

export type StreamMessage = ChatTokenMessage | WorkflowUpdateMessage | ChatStatusMessage

type EventListener = (data: any) => void

export class SSEService {
  private listeners: Map<string, EventListener[]> = new Map()
  private eventSource: EventSource | null = null
  private url: string
  private isConnected = false

  constructor(baseUrl?: string) {
    // Default to backend API endpoint
    this.url = baseUrl || '/api/chat/stream'
  }

  // Simple event emitter implementation
  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  off(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(data))
    }
  }

  async sendMessage(
    message: string,
    assistantType: string = 'general',
    userId: string,
    context?: any
  ): Promise<void> {
    // Close existing connection if any
    this.disconnect()

    // Make POST request to initiate SSE stream
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        assistantType,
        userId,
        context,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      this.emit('error', { type: 'request_error', error })
      throw new Error(error.message || 'Failed to start stream')
    }

    // Check if response is SSE
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('text/event-stream')) {
      // Non-streaming response
      const data = await response.json()
      this.handleMessage(data)
      return
    }

    // Handle SSE stream
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    this.isConnected = true
    this.emit('connected')

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              this.handleMessage(data)
            } catch (error) {
              console.error('Failed to parse SSE message:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading SSE stream:', error)
      this.emit('error', { type: 'stream_error', error })
    } finally {
      this.isConnected = false
      this.emit('disconnected')
    }
  }

  private handleMessage(message: StreamMessage) {
    // Emit specific events based on message type
    switch (message.type) {
      case 'token':
        this.emit('token', message as ChatTokenMessage)
        break
      
      case 'workflow_update':
        this.emit('workflow_update', message as WorkflowUpdateMessage)
        break
      
      case 'chat_started':
        this.emit('chat_started', message)
        break
      
      case 'chat_completed':
        this.emit('chat_completed', message)
        break
      
      case 'workflow_detected':
        this.emit('workflow_detected', message)
        break
      
      case 'provider_switch':
        this.emit('provider_switch', message)
        break
      
      case 'error':
        this.emit('chat_error', message)
        break
      
      default:
        // Emit generic message event for unknown types
        this.emit('message', message)
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.isConnected = false
  }

  getConnectionState(): boolean {
    return this.isConnected
  }
}