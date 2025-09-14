import { useEffect, useRef, useState, useCallback } from 'react'
import { SSEService, ChatTokenMessage, WorkflowUpdateMessage, ChatStatusMessage } from '../services/sse.service'

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

export interface UseSSEChatOptions {
  onError?: (error: any) => void
  apiUrl?: string
}

export function useSSEChat(options: UseSSEChatOptions = {}) {
  const { onError, apiUrl } = options
  
  const sseRef = useRef<SSEService | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null)
  const streamMessageIdRef = useRef<string | null>(null)

  // Initialize SSE service
  useEffect(() => {
    if (!sseRef.current) {
      sseRef.current = new SSEService(apiUrl)
      
      // Set up event listeners
      sseRef.current.on('connected', () => {
        setIsConnected(true)
        console.log('SSE connected')
      })

      sseRef.current.on('disconnected', () => {
        setIsConnected(false)
        setIsStreaming(false)
      })

      sseRef.current.on('error', (error) => {
        console.error('SSE error:', error)
        if (onError) {
          onError(error)
        }
      })

      // Handle chat events
      sseRef.current.on('chat_started', (data: ChatStatusMessage) => {
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

      sseRef.current.on('token', (data: ChatTokenMessage) => {
        // Append token to current stream content
        setCurrentStreamContent(prev => {
          const newContent = prev + data.content
          
          // Update the streaming message
          if (streamMessageIdRef.current) {
            setMessages(prevMessages => prevMessages.map(msg => 
              msg.id === streamMessageIdRef.current 
                ? { ...msg, content: newContent }
                : msg
            ))
          }
          
          return newContent
        })
      })

      sseRef.current.on('chat_completed', (data: ChatStatusMessage) => {
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
      sseRef.current.on('workflow_detected', (data: any) => {
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

      sseRef.current.on('workflow_update', (data: WorkflowUpdateMessage) => {
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

      sseRef.current.on('provider_switch', (data: any) => {
        console.log('Provider switched:', data)
      })

      sseRef.current.on('chat_error', (data: any) => {
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

    // Cleanup
    return () => {
      if (sseRef.current) {
        sseRef.current.disconnect()
        sseRef.current = null
      }
    }
  }, [apiUrl, onError])

  // Send message function
  const sendMessage = useCallback(async (
    content: string,
    assistantType: string = 'general',
    userId: string = 'user-123',
    context?: any
  ) => {
    if (!sseRef.current) {
      console.error('SSE not initialized')
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

    setIsStreaming(true)
    setIsConnected(true)

    try {
      // Send via SSE service
      await sseRef.current.sendMessage(content, assistantType, userId, context)
    } catch (error) {
      setIsStreaming(false)
      setIsConnected(false)
      console.error('Failed to send message:', error)
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }])
    }
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setWorkflowStatus(null)
    setCurrentStreamContent('')
    streamMessageIdRef.current = null
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
  }
}