import React, { useState, useRef, useEffect } from 'react'
import { usePollingChat } from '../hooks/usePollingChat'

export interface ChatInterfaceProps {
  userId?: string
  defaultAssistantType?: string
  className?: string
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId = 'user-123',
  defaultAssistantType = 'general',
  className = '',
}) => {
  const [input, setInput] = useState('')
  const [assistantType, setAssistantType] = useState(defaultAssistantType)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    isConnected,
    isStreaming,
    messages,
    workflowStatus,
    sendMessage,
    clearMessages,
  } = usePollingChat({
    onError: (error) => {
      console.error('Chat error:', error)
    },
    apiUrl: '/api/chat/stream',
    pollingInterval: 1000, // Poll every second for workflow updates
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isStreaming) {
      return
    }

    sendMessage(input, assistantType, userId)
    setInput('')
  }

  const assistantTypes = [
    { value: 'general', label: 'General Assistant' },
    { value: 'analyst', label: 'Financial Analyst' },
    { value: 'trader', label: 'Trader' },
    { value: 'advisor', label: 'Financial Advisor' },
    { value: 'riskManager', label: 'Risk Manager' },
    { value: 'economist', label: 'Economist' },
  ]

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Assistant Type Selector */}
          <select
            value={assistantType}
            onChange={(e) => setAssistantType(e.target.value)}
            className="px-3 py-1 text-sm border rounded-md"
            disabled={isStreaming}
          >
            {assistantTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={clearMessages}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          disabled={isStreaming}
        >
          Clear Chat
        </button>
      </div>

      {/* Workflow Status */}
      {workflowStatus && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="text-sm font-medium text-blue-800">
            Multi-Agent Workflow {workflowStatus.status === 'completed' ? 'Completed' : 'Active'}
          </div>
          <div className="mt-2 space-y-2">
            {workflowStatus.agents && workflowStatus.agents.map((agent, index) => (
              <div key={agent.name} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  agent.status === 'completed' ? 'bg-green-500' :
                  agent.status === 'running' ? 'bg-blue-500 animate-pulse' :
                  'bg-gray-300'
                }`} />
                <span className={`${
                  agent.status === 'running' ? 'font-semibold' : ''
                }`}>
                  {agent.name}
                </span>
                {agent.status === 'completed' && (
                  <span className="text-green-600">✓</span>
                )}
              </div>
            ))}
            {workflowStatus.progress !== undefined && (
              <div className="mt-2">
                <div className="w-full bg-blue-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${workflowStatus.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation by typing a message below
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-100 text-gray-700 italic'
                  : message.role === 'workflow'
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {message.metadata?.assistantType && (message.role === 'assistant' || message.role === 'workflow') && (
                <div className="text-xs opacity-75 mb-1 font-semibold">
                  {message.metadata.agent ? `Agent: ${message.metadata.agent}` : message.metadata.assistantType}
                  {message.metadata.provider && ` • ${message.metadata.provider}`}
                </div>
              )}
              
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              <div className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isStreaming 
                ? 'Please wait for response...'
                : 'Type your message...'
            }
            disabled={isStreaming}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}