'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  chatStream,
  executeMCPTool,
  ChatMessage,
  ChatContext,
  ChatStreamEvent,
  MCPToolResult,
} from '@/app/lib/mcp-api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
  toolCalls?: Array<{ name: string; result?: string }>;
  timestamp: Date;
}

interface MCPChatProps {
  context?: ChatContext;
}

const quickActions = [
  { label: 'Analyze Slow Queries', tool: 'analyze_slow_queries', icon: '🐢' },
  { label: 'Performance Report', tool: 'generate_performance_report', icon: '📊' },
  { label: 'Failed Queries', tool: 'get_failed_queries', icon: '❌' },
  { label: 'Duration Chart', tool: 'generate_duration_chart', icon: '📈' },
];

export default function MCPChat({ context = {} }: MCPChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleQuickAction = async (toolName: string) => {
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Running ${toolName}...`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const result = await executeMCPTool(toolName, context);
      const assistantMessage = formatToolResult(result, toolName);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatToolResult = (result: MCPToolResult, toolName: string): Message => {
    const textContent = result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const images = result.content
      .filter((c) => c.type === 'image')
      .map((c) => ({ data: c.data!, mimeType: c.mimeType! }));

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: textContent,
      images: images.length > 0 ? images : undefined,
      toolCalls: [{ name: toolName }],
      timestamp: new Date(),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let fullContent = '';
      const collectedImages: Array<{ data: string; mimeType: string }> = [];
      const toolCalls: Array<{ name: string; result?: string }> = [];

      for await (const event of chatStream(userMessage.content, history, context)) {
        switch (event.type) {
          case 'text':
            fullContent += event.content;
            setStreamingContent(fullContent);
            break;
          case 'tool_call':
            toolCalls.push({ name: event.toolName || 'unknown' });
            break;
          case 'tool_result':
            if (toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1].result = event.content;
            }
            break;
          case 'image':
            collectedImages.push({
              data: event.content,
              mimeType: event.mimeType || 'image/png',
            });
            break;
          case 'error':
            fullContent += `\n\nError: ${event.content}`;
            setStreamingContent(fullContent);
            break;
          case 'done':
            break;
        }
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        images: collectedImages.length > 0 ? collectedImages : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 p-4 dark:border-zinc-800">
        <span className="text-sm text-zinc-500">Quick actions:</span>
        {quickActions.map((action) => (
          <button
            key={action.tool}
            onClick={() => handleQuickAction(action.tool)}
            disabled={isLoading}
            className="flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <div className="mb-4 text-4xl">🤖</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-700 dark:text-zinc-300">
              AI Analysis Assistant
            </h3>
            <p className="max-w-md text-sm">
              Ask questions about your ClickHouse queries, request performance analysis, or use the
              quick actions above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  }`}
                >
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {message.toolCalls.map((tc, i) => (
                        <span
                          key={i}
                          className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                        >
                          🔧 {tc.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.images.map((img, i) => (
                        <img
                          key={i}
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt="Chart"
                          className="max-w-full rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs opacity-60">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming content */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-zinc-100 p-3 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                  <div className="whitespace-pre-wrap text-sm">{streamingContent}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
                    <span className="text-xs opacity-60">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500"></span>
                    <span className="animation-delay-150 h-2 w-2 animate-bounce rounded-full bg-blue-500"></span>
                    <span className="animation-delay-300 h-2 w-2 animate-bounce rounded-full bg-blue-500"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about query performance, slow queries, optimization suggestions..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
