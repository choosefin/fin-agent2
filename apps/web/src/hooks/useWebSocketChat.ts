import { useEffect, useRef, useState, useCallback } from 'react'
import { WebSocketService, ChatTokenMessage, WorkflowUpdateMessage, ChatStatusMessage } from '../lib/websocket.service'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    provider?: string
    model?: string
    assistantType?: string
    workflowId?: string
  }
}

export interface WorkflowStatus {
  workflowId: string
  agents: string[]
  currentAgent?: string
  currentTask?: string
  progress?: number
  results?: any[]
}

export interface UseWebSocketChatOptions {
  autoConnect?: boolean
  onError?: (error: any) => void
  onReconnecting?: (attempt: number) => void
  wsUrl?: string
}

export function useWebSocketChat(options: UseWebSocketChatOptions = {}) {
  const { autoConnect = true, onError, onReconnecting, wsUrl } = options
  
  const wsRef = useRef<WebSocketService | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null)
  const streamMessageIdRef = useRef<string | null>(null)

  // Initialize WebSocket service
  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new WebSocketService(wsUrl)
      
      // Set up event listeners
      wsRef.current.on('connected', () => {
        setIsConnected(true)
        console.log('WebSocket connected in hook')
      })

      wsRef.current.on('disconnected', () => {
        setIsConnected(false)
        setIsStreaming(false)
      })

      wsRef.current.on('reconnecting', ({ attempt }) => {
        if (onReconnecting) {
          onReconnecting(attempt)
        }
      })

      wsRef.current.on('error', (error) => {
        console.error('WebSocket error in hook:', error)
        if (onError) {
          onError(error)
        }
      })

      // Handle chat events
      wsRef.current.on('chat_started', (data: ChatStatusMessage) => {
        setIsStreaming(true)
        setCurrentStreamContent('')
        streamMessageIdRef.current = `msg-${Date.now()}`
        
        // Add placeholder message for streaming
        setMessages(prev => [...prev, {
          id: streamMessageIdRef.current!,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          metadata: {
            assistantType: data.assistantType,
          }
        }])
      })

      wsRef.current.on('token', (data: ChatTokenMessage) => {
        // Append token to current stream content
        setCurrentStreamContent(prev => prev + data.content)
        
        // Update the streaming message
        if (streamMessageIdRef.current) {
          setMessages(prev => prev.map(msg => 
            msg.id === streamMessageIdRef.current 
              ? { ...msg, content: currentStreamContent + data.content }
              : msg
          ))
        }
      })

      wsRef.current.on('chat_completed', (data: ChatStatusMessage) => {
        setIsStreaming(false)
        
        // Update message metadata
        if (streamMessageIdRef.current) {
          setMessages(prev => prev.map(msg => 
            msg.id === streamMessageIdRef.current 
              ? { 
                  ...msg, 
                  metadata: {
                    ...msg.metadata,
                    provider: data.provider,
                    model: data.model,
                  }
                }
              : msg
          ))
        }
        
        streamMessageIdRef.current = null
        setCurrentStreamContent('')
      })

      // Handle workflow events
      wsRef.current.on('workflow_detected', (data: any) => {
        setWorkflowStatus({
          workflowId: data.workflowId,
          agents: data.agents,
          progress: 0,
        })
        
        // Add system message
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: data.message,
          timestamp: new Date(),
          metadata: {
            workflowId: data.workflowId,
          }
        }])
      })

      wsRef.current.on('workflow_update', (data: WorkflowUpdateMessage) => {
        // Update workflow status
        setWorkflowStatus(prev => {
          if (!prev || prev.workflowId !== data.workflowId) return prev
          
          return {
            ...prev,
            currentAgent: data.agent,
            currentTask: data.task,
            progress: data.progress,
            results: data.results ? [...(prev.results || []), data.results] : prev.results,
          }
        })

        // Add workflow update to messages if it contains results
        if (data.results && data.message) {
          setMessages(prev => [...prev, {
            id: `workflow-${Date.now()}`,
            role: 'assistant',
            content: data.message,
            timestamp: new Date(data.timestamp || Date.now()),
            metadata: {
              workflowId: data.workflowId,
              assistantType: data.agent,
            }
          }])
        }
      })

      wsRef.current.on('provider_switch', (data: any) => {
        console.log('Provider switched:', data)
      })

      wsRef.current.on('chat_error', (data: any) => {
        setIsStreaming(false)
        
        // Add error message
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${data.message}`,
          timestamp: new Date(),
        }])
      })
    }

    // Auto-connect if enabled
    if (autoConnect && wsRef.current && !isConnected) {
      wsRef.current.connect().catch(console.error)
    }

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
    }
  }, []) // Empty deps, only run once

  // Send message function
  const sendMessage = useCallback((
    content: string,
    assistantType: string = 'general',
    userId: string = 'user-123',
    context?: any
  ) => {
    if (!wsRef.current) {
      console.error('WebSocket not initialized')
      return
    }

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    // Send via WebSocket
    wsRef.current.sendChatMessage(content, assistantType, userId, context)
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setWorkflowStatus(null)
    setCurrentStreamContent('')
    streamMessageIdRef.current = null
  }, [])

  // Manual connect/disconnect
  const connect = useCallback(() => {
    return wsRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect()
  }, [])

  return {
    // State
    isConnected,
    isStreaming,
    messages,
    workflowStatus,
    
    // Actions
    sendMessage,
    clearMessages,
    connect,
    disconnect,
  }
}