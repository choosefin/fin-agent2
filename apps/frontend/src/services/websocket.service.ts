export interface WebSocketMessage {
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

export class WebSocketService {
  private listeners: Map<string, EventListener[]> = new Map()
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageQueue: any[] = []
  private isConnected = false
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(url?: string) {
    // Default to ws://localhost:3210/ws/chat for Motia WebSocket
    this.url = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3210/ws/chat`
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

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.emit('connected')
          
          // Start heartbeat
          this.startHeartbeat()
          
          // Send any queued messages
          this.flushMessageQueue()
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as StreamMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
            this.emit('error', { type: 'parse_error', error })
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', { type: 'connection_error', error })
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.isConnected = false
          this.stopHeartbeat()
          this.emit('disconnected', { code: event.code, reason: event.reason })
          
          // Attempt reconnection if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
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

  send(data: any): void {
    const message = typeof data === 'string' ? data : JSON.stringify(data)
    
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message)
    } else {
      // Queue message if not connected
      this.messageQueue.push(message)
      
      // Try to reconnect if disconnected
      if (!this.isConnected) {
        this.connect().catch(console.error)
      }
    }
  }

  sendChatMessage(
    message: string, 
    assistantType: string = 'general',
    userId: string,
    context?: any
  ): void {
    this.send({
      message,
      assistantType,
      userId,
      context,
    })
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message)
      }
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay })
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('reconnect_failed', { attempts: this.reconnectAttempts })
        }
      })
    }, delay)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.isConnected = false
    this.messageQueue = []
  }

  getConnectionState(): boolean {
    return this.isConnected
  }

  getReadyState(): number | undefined {
    return this.ws?.readyState
  }
}