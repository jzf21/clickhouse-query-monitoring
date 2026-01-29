import { config } from '../config.js';
import type { ChatMessage } from '../types/api.js';

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  finishReason: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * OpenAI-compatible AI provider that works with both OpenAI and Nebius APIs
 */
export class AIProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl?: string, apiKey?: string, model?: string) {
    this.baseUrl = baseUrl ?? config.aiBaseUrl;
    this.apiKey = apiKey ?? config.aiApiKey;
    this.model = model ?? config.aiModel;
  }

  /**
   * Send a chat completion request (non-streaming)
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content ?? '',
      finishReason: data.choices[0]?.finish_reason ?? 'stop',
    };
  }

  /**
   * Send a chat completion request with streaming
   */
  async *chatStream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content ?? '';
          if (content) {
            yield { content, done: false };
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Analyze slow queries and provide optimization suggestions
   */
  async analyzeSlowQueries(
    queries: Array<{
      query: string;
      duration_ms: number;
      memory_usage: number;
      read_rows: number;
    }>
  ): Promise<string> {
    const systemPrompt = `You are a ClickHouse performance expert. Analyze the provided slow queries and give:
1. Common patterns causing slow performance
2. Specific optimization suggestions for each query
3. Index recommendations if applicable
4. General best practices violations detected

Be concise and actionable in your recommendations.`;

    const userPrompt = `Analyze these ${queries.length} slow queries:

${queries
  .map(
    (q, i) =>
      `Query ${i + 1}:
- Duration: ${q.duration_ms}ms
- Memory: ${(q.memory_usage / 1024 / 1024).toFixed(2)} MB
- Rows Read: ${q.read_rows.toLocaleString()}
- SQL: ${q.query.substring(0, 500)}${q.query.length > 500 ? '...' : ''}`
  )
  .join('\n\n')}`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return response.content;
  }

  /**
   * Suggest optimizations for a specific query
   */
  async suggestQueryOptimization(query: string): Promise<string> {
    const systemPrompt = `You are a ClickHouse query optimization expert. Analyze the provided SQL query and suggest optimizations:
1. Identify potential performance issues
2. Suggest rewritten versions if applicable
3. Recommend indexes that could help
4. Point out any anti-patterns

Format your response with clear sections and code examples where helpful.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Optimize this ClickHouse query:\n\n${query}` },
    ]);

    return response.content;
  }

  /**
   * Generate a performance summary from metrics
   */
  async generatePerformanceSummary(metrics: {
    totalQueries: number;
    avgDuration: number;
    maxDuration: number;
    failedQueries: number;
    totalReadBytes: number;
    timeRange: string;
  }): Promise<string> {
    const systemPrompt = `You are a database monitoring analyst. Provide a brief, insightful summary of the ClickHouse performance metrics. Highlight any concerns and suggest areas for investigation.`;

    const userPrompt = `Performance Summary for ${metrics.timeRange}:
- Total Queries: ${metrics.totalQueries.toLocaleString()}
- Average Duration: ${metrics.avgDuration.toFixed(2)}ms
- Max Duration: ${metrics.maxDuration.toFixed(2)}ms
- Failed Queries: ${metrics.failedQueries}
- Total Data Read: ${(metrics.totalReadBytes / 1024 / 1024 / 1024).toFixed(2)} GB

Provide insights and recommendations.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return response.content;
  }
}

export const aiProvider = new AIProvider();
