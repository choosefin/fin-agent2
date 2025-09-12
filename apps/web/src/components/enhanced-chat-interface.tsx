'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { AssistantProfile } from './assistant-selector';
import { WorkflowVisualizer } from './workflow-visualizer';
import { WorkflowTrigger } from './workflow-trigger';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  assistantType?: string;
  workflowId?: string;
  isWorkflowResult?: boolean;
}

interface WorkflowStep {
  index: number;
  agent: string;
  task: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
}

interface ActiveWorkflow {
  workflowId: string;
  name: string;
  steps: WorkflowStep[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface ChatResponse {
  response: string;
  traceId?: string;
  assistantType?: string;
  llmProvider?: string;
  participantAgents?: string[];
  debateRounds?: unknown[];
}

interface EnhancedChatInterfaceProps {
  assistant: AssistantProfile;
  onSendMessage?: (message: string) => Promise<ChatResponse>;
}

export function EnhancedChatInterface({ assistant, onSendMessage }: EnhancedChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);
  const [showWorkflowTrigger, setShowWorkflowTrigger] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleWorkflowEvent = React.useCallback((event: {
    type: string;
    data: {
      workflowId: string;
      name?: string;
      steps?: Array<{ agent: string; task: string }>;
      stepIndex?: number;
      agent?: string;
      task?: string;
      result?: string;
      error?: string;
      results?: Array<{ agent: string; result: string }>;
    };
  }) => {
    switch (event.type) {
      case 'workflow.started':
        setActiveWorkflow({
          workflowId: event.data.workflowId,
          name: event.data.name || 'Workflow',
          steps: event.data.steps?.map((s, i: number) => ({
            index: i,
            agent: s.agent,
            task: s.task,
            status: 'pending' as const,
          })) || [],
          progress: {
            completed: 0,
            total: event.data.steps?.length || 0,
            percentage: 0,
          },
        });
        break;

      case 'workflow.agent.started':
        if (activeWorkflow?.workflowId === event.data.workflowId) {
          setActiveWorkflow(prev => {
            if (!prev) return null;
            const steps = [...prev.steps];
            if (event.data.stepIndex !== undefined) {
              steps[event.data.stepIndex].status = 'processing';
            }
            return { ...prev, steps };
          });
        }
        break;

      case 'workflow.agent.completed':
        if (activeWorkflow?.workflowId === event.data.workflowId) {
          setActiveWorkflow(prev => {
            if (!prev) return null;
            const steps = [...prev.steps];
            if (event.data.stepIndex !== undefined) {
              steps[event.data.stepIndex].status = event.data.error ? 'error' : 'completed';
              steps[event.data.stepIndex].result = event.data.result;
            }
            
            const completed = steps.filter(s => s.status === 'completed').length;
            return {
              ...prev,
              steps,
              progress: {
                completed,
                total: prev.progress.total,
                percentage: Math.round((completed / prev.progress.total) * 100),
              },
            };
          });
        }
        break;

      case 'workflow.completed':
        if (activeWorkflow?.workflowId === event.data.workflowId) {
          // Add workflow completion message
          const workflowMessage: Message = {
            id: Date.now().toString(),
            role: 'system',
            content: `✨ Workflow completed! ${event.data.results?.length || 0} agents have provided their analysis.`,
            timestamp: new Date(),
            workflowId: event.data.workflowId,
            isWorkflowResult: true,
          };
          setMessages(prev => [...prev, workflowMessage]);
          
          // Compile results into a single message
          const compiledResults = event.data.results?.map((r) => 
            `**${r.agent.toUpperCase()} AGENT:**\n${r.result}`
          ).join('\n\n---\n\n') || 'No results available';
          
          const resultMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: compiledResults,
            timestamp: new Date(),
            assistantType: 'workflow',
            workflowId: event.data.workflowId,
          };
          setMessages(prev => [...prev, resultMessage]);
        }
        break;
    }
  }, [activeWorkflow]);

  // Setup SSE connection for workflow updates
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    const eventSource = new EventSource(`${apiUrl}/api/workflow/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWorkflowEvent(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [handleWorkflowEvent]);

  const triggerWorkflow = async (message: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    
    try {
      const response = await fetch(`${apiUrl}/api/workflow/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          userId: 'user-' + Date.now(),
          context: {
            symbols: [],
            timeframe: '1d',
            riskTolerance: 'moderate',
          },
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to trigger workflow:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowWorkflowTrigger(false);

    try {
      // Check if this should trigger a workflow
      const workflowResponse = await triggerWorkflow(userMessage.content);
      
      if (workflowResponse.triggered) {
        // Workflow was triggered
        const systemMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: `🚀 ${workflowResponse.message}`,
          timestamp: new Date(),
          workflowId: workflowResponse.workflowId,
        };
        setMessages((prev) => [...prev, systemMessage]);
      } else {
        // Regular chat message
        const response = await (onSendMessage || defaultMessageHandler)(
          userMessage.content
        );

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response || response,
          timestamp: new Date(),
          assistantType: assistant.id,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        assistantType: assistant.id,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const defaultMessageHandler = async (message: string): Promise<ChatResponse> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        assistantType: assistant.id,
        userId: 'user-' + Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    return await response.json();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleWorkflowTrigger = (prompt: string) => {
    setInput(prompt);
    setShowWorkflowTrigger(false);
    inputRef.current?.focus();
  };

  const AssistantIcon = assistant.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Active Workflow Visualizer */}
      {activeWorkflow && (
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <WorkflowVisualizer
            workflowId={activeWorkflow.workflowId}
            workflowName={activeWorkflow.name}
            steps={activeWorkflow.steps}
            progress={activeWorkflow.progress}
            onClose={() => setActiveWorkflow(null)}
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
            
            <Button
              onClick={() => setShowWorkflowTrigger(!showWorkflowTrigger)}
              className="mt-6"
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Show Workflow Examples
            </Button>
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
                <p className="whitespace-pre-wrap">{message.content}</p>
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
        
        {showWorkflowTrigger && (
          <div className="mt-8">
            <WorkflowTrigger 
              onTriggerWorkflow={handleWorkflowTrigger}
              isLoading={isLoading}
            />
          </div>
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
          <Button
            type="button"
            onClick={() => setShowWorkflowTrigger(!showWorkflowTrigger)}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
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

export default EnhancedChatInterface;