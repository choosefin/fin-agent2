'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { AssistantProfile } from './assistant-selector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  assistantType?: string;
}

interface ChatInterfaceProps {
  assistant: AssistantProfile;
  onSendMessage?: (message: string) => Promise<string>;
}

export function ChatInterface({ assistant, onSendMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    try {
      // Call the API or handler
      const response = await (onSendMessage || defaultMessageHandler)(
        userMessage.content
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        assistantType: assistant.id,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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

  const defaultMessageHandler = async (message: string): Promise<string> => {
    try {
      // Use Next.js API route as proxy to avoid CORS issues
      console.log('Sending chat request via Next.js proxy');
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          assistantType: assistant.id,
          userId: 'user-' + Date.now(), // Temporary user ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Fetch error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the chat service.');
      }
      throw error;
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
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <AssistantIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Hi! I&apos;m your {assistant.name}</p>
            <p className="text-sm mt-2">{assistant.description}</p>
            <p className="text-sm mt-4">How can I help you today?</p>
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
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                )}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom styling for markdown elements
                        h1: ({children}) => <h1 className="text-xl font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">{children}</h3>,
                        p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="leading-relaxed">{children}</li>,
                        strong: ({children}) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                        em: ({children}) => <em className="italic">{children}</em>,
                        code: ({className, children}) => {
                          const inline = !className;
                          return inline ? (
                            <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                          ) : (
                            <code className="block bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-lg overflow-x-auto font-mono text-sm my-2">{children}</code>
                          );
                        },
                        pre: ({children}) => <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                        blockquote: ({children}) => (
                          <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-3 italic text-gray-700 dark:text-gray-300">
                            {children}
                          </blockquote>
                        ),
                        hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
                        a: ({href, children}) => (
                          <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                        table: ({children}) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({children}) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
                        tbody: ({children}) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>,
                        tr: ({children}) => <tr>{children}</tr>,
                        th: ({children}) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{children}</th>,
                        td: ({children}) => <td className="px-3 py-2 text-sm">{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
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
        {isLoading && (
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

export default ChatInterface;