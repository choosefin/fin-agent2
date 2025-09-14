'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, User, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { AssistantProfile } from './assistant-selector';
import { AgentStatusPanel } from './agent-status-panel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  assistantType?: string;
  workflowId?: string;
  chartHtml?: string;
  chartIframe?: string;
  symbol?: string;
  hasChart?: boolean;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  result?: string;
  startTime?: Date;
  endTime?: Date;
  currentAction?: string;
}

interface ActiveWorkflow {
  workflowId: string;
  agents: AgentStatus[];
  estimatedTime: number;
}

interface SmartChatInterfaceProps {
  assistant: AssistantProfile;
}

export function SmartChatInterface({ assistant }: SmartChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const pollWorkflowStatus = useCallback(async (workflowId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/workflow/${workflowId}/status`);
      
      if (!response.ok) {
        console.error('Failed to fetch workflow status');
        return;
      }
      
      const data = await response.json();
      
      // Update workflow status based on the response
      if (data.workflowId === workflowId) {
        // Update agent statuses from the response
        setActiveWorkflow(prev => {
          if (!prev) return null;
          return {
            ...prev,
            agents: data.steps?.map((step: { agent: string; status: string; result?: { result?: string } | string; task?: string; startedAt?: string; completedAt?: string }) => ({
              id: step.agent,
              name: step.agent.charAt(0).toUpperCase() + step.agent.slice(1),
              status: step.status === 'completed' ? 'completed' : 
                      step.status === 'processing' ? 'processing' : 'pending',
              result: typeof step.result === 'object' ? step.result?.result : step.result,
              startTime: step.startedAt ? new Date(step.startedAt) : undefined,
              endTime: step.completedAt ? new Date(step.completedAt) : undefined,
              currentAction: step.task,
              progress: step.status === 'completed' ? 100 : 
                       step.status === 'processing' ? 50 : 0,
            })) || prev.agents,
          };
        });
        
        // If workflow is completed, stop polling and show results
        if (data.status === 'completed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsLoading(false);
          
          // Add compiled results message
          if (data.results && data.results.length > 0) {
            const compiledMessage = data.results.map((r: { agent: string; result: string }) => 
              `**${r.agent.toUpperCase()} Analysis:**\n\n${r.result}`
            ).join('\n\n---\n\n');

            setMessages(prev => [...prev, {
              id: `workflow-result-${Date.now()}`,
              role: 'assistant',
              content: compiledMessage || 'Analysis complete.',
              timestamp: new Date(),
              workflowId: data.workflowId,
            }]);
          }
          
          // Clear workflow after 5 seconds
          setTimeout(() => {
            setActiveWorkflow(null);
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Failed to poll workflow status:', error);
    }
  }, []);

  // Function to establish SSE connection only when needed
  // Start polling for workflow status
  const startPollingWorkflow = useCallback((workflowId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Initial poll
    pollWorkflowStatus(workflowId);
    
    // Set up polling interval (every 1 second)
    pollingIntervalRef.current = setInterval(() => {
      pollWorkflowStatus(workflowId);
    }, 1000);
  }, [pollWorkflowStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      // Call the unified chat/stream endpoint
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          assistantType: assistant.id,
          userId: `user-${Date.now()}`,
          context: {
            symbols: [],
            timeframe: '1d',
            riskTolerance: 'moderate',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.workflowId) {
        // Workflow was triggered
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `🚀 ${data.message || 'Workflow initiated'}\n\nInitializing ${data.agents?.length || 0} specialized agents for comprehensive analysis...`,
          timestamp: new Date(),
          workflowId: data.workflowId,
        }]);

        // Initialize workflow status
        setActiveWorkflow({
          workflowId: data.workflowId,
          estimatedTime: data.estimatedTime || 30,
          agents: (data.agents || []).map((agentId: string) => ({
            id: agentId,
            name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
            status: 'pending' as const,
          })),
        });

        // Start polling for workflow status
        startPollingWorkflow(data.workflowId);
        
      } else {
        // Regular chat response
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          assistantType: assistant.id,
          chartHtml: data.chartHtml,
          chartIframe: data.chartIframe,
          symbol: data.symbol,
          hasChart: data.hasChart,
        }]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const AssistantIcon = assistant.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Active Workflow Panel */}
      {activeWorkflow && (
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <AgentStatusPanel
            agents={activeWorkflow.agents}
            workflowId={activeWorkflow.workflowId}
            estimatedTime={activeWorkflow.estimatedTime}
            onClose={() => {
              setActiveWorkflow(null);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            }}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <AssistantIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Hi! I&apos;m your {assistant.name}</p>
            <p className="text-sm mt-2">{assistant.description}</p>
            <p className="text-sm mt-4">How can I help you today?</p>
            
            <div className="mt-8 space-y-3 max-w-md mx-auto">
              <p className="text-xs text-gray-400">Try asking:</p>
              <div className="space-y-2">
                <button
                  onClick={() => setInput("Analyze the current market trends for tech stocks")}
                  className="w-full text-left px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  📊 Analyze market trends
                </button>
                <button
                  onClick={() => setInput("Should I invest in renewable energy stocks?")}
                  className="w-full text-left px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  💡 Investment advice
                </button>
                <button
                  onClick={() => setInput("Comprehensive risk assessment of my portfolio")}
                  className="w-full text-left px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  🛡️ Risk assessment
                </button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', assistant.color)}>
                  <AssistantIcon className="h-5 w-5 text-white" />
                </div>
              )}
              {message.role === 'system' && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                    ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-gray-900 dark:text-gray-100'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                )}
              >
                {message.role === 'assistant' && message.content ? (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                
                {/* Render TradingView chart if present */}
                {message.hasChart && message.chartIframe && (
                  <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div dangerouslySetInnerHTML={{ __html: message.chartIframe }} />
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && !activeWorkflow && (
          <div className="flex gap-3">
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', assistant.color)}>
              <AssistantIcon className="h-5 w-5 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${assistant.name} anything...`}
            className="flex-1 resize-none rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex gap-2 mt-2 text-xs text-gray-500">
          {assistant.expertise.map((skill) => (
            <span key={skill} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
              {skill}
            </span>
          ))}
        </div>
      </form>
    </div>
  );
}

export default SmartChatInterface;