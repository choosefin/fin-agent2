import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'workflow'
  content: string
  timestamp: Date
  metadata?: {
    provider?: string
    model?: string
    assistantType?: string
    workflowId?: string
    agent?: string
  }
}

export interface WorkflowStatus {
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  agents: Array<{
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    result?: any
  }>
  currentAgent?: string
  currentTask?: string
  progress?: number
  results?: any[]
  finalResult?: string
}

export interface UsePollingChatOptions {
  onError?: (error: any) => void
  apiUrl?: string
  pollingInterval?: number
}

export function usePollingChat(options: UsePollingChatOptions = {}) {
  const { 
    onError, 
    apiUrl = '/api/chat/stream',
    pollingInterval = 1000 // Poll every second
  } = options
  
  const [isConnected, setIsConnected] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentWorkflowIdRef = useRef<string | null>(null)

  // Poll workflow status
  const pollWorkflowStatus = useCallback(async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflow/status/${workflowId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow status: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Update workflow status
      setWorkflowStatus({
        workflowId,
        status: data.status,
        agents: data.agents || [],
        currentAgent: data.currentAgent,
        currentTask: data.currentTask,
        progress: data.progress,
        results: data.results,
        finalResult: data.finalResult,
      })

      // Add messages for completed agents
      if (data.agents) {
        data.agents.forEach((agent: any) => {
          if (agent.status === 'completed' && agent.result) {
            // Check if we already have this result
            const existingMessage = messages.find(
              m => m.metadata?.agent === agent.name && m.metadata?.workflowId === workflowId
            )
            
            if (!existingMessage) {
              setMessages(prev => [...prev, {
                id: `${workflowId}-${agent.name}`,
                role: 'workflow',
                content: agent.result.response || agent.result.message || JSON.stringify(agent.result),
                timestamp: new Date(),
                metadata: {
                  workflowId,
                  agent: agent.name,
                  assistantType: agent.name,
                }
              }])
            }
          }
        })
      }

      // Stop polling if workflow is completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        setIsStreaming(false)
        currentWorkflowIdRef.current = null

        // Add final result message if available
        if (data.finalResult) {
          setMessages(prev => [...prev, {
            id: `${workflowId}-final`,
            role: 'assistant',
            content: data.finalResult,
            timestamp: new Date(),
            metadata: {
              workflowId,
              assistantType: 'workflow-summary',
            }
          }])
        }
      }
    } catch (error) {
      console.error('Error polling workflow status:', error)
      if (onError) {
        onError(error)
      }
    }
  }, [messages, onError])

  // Send message function
  const sendMessage = useCallback(async (
    content: string,
    assistantType: string = 'general',
    userId: string = 'user-123',
    context?: any
  ) => {
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)

    try {
      // Send message to backend
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          assistantType,
          userId,
          context,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Check if response is JSON (non-streaming response)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        // Regular JSON response - likely an error or immediate response
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.message || data.error)
        }

        // Check if this triggered a workflow
        if (data.workflowId) {
          currentWorkflowIdRef.current = data.workflowId
          
          // Add system message about workflow
          setMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: 'Initiating multi-agent analysis...',
            timestamp: new Date(),
            metadata: {
              workflowId: data.workflowId,
            }
          }])

          // Start polling for workflow status
          pollingIntervalRef.current = setInterval(() => {
            if (currentWorkflowIdRef.current) {
              pollWorkflowStatus(currentWorkflowIdRef.current)
            }
          }, pollingInterval)
        } else if (data.response) {
          // Direct response without workflow
          setMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            metadata: {
              provider: data.llmProvider,
              assistantType: data.assistantType,
            }
          }])
          setIsStreaming(false)
        }
      } else {
        // The backend returns an empty response for SSE attempts
        // We need to check if a workflow was triggered
        // For now, assume it triggered a workflow and start polling
        const workflowId = `workflow-${Date.now()}`
        currentWorkflowIdRef.current = workflowId
        
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: 'Processing your request...',
          timestamp: new Date(),
          metadata: {
            workflowId,
          }
        }])

        // Start polling - the backend should have the workflow ID
        setTimeout(() => {
          pollWorkflowStatus(workflowId)
        }, 500)
      }
    } catch (error) {
      setIsStreaming(false)
      console.error('Failed to send message:', error)
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }])
      
      if (onError) {
        onError(error)
      }
    }
  }, [apiUrl, onError, pollWorkflowStatus, pollingInterval])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setWorkflowStatus(null)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    currentWorkflowIdRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
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