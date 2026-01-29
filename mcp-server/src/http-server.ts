import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { allTools, toolsMap } from './tools/index.js';
import { aiProvider } from './services/ai-provider.js';
import { backendClient } from './services/backend-client.js';
import type { ChatMessage, ChatRequest } from './types/api.js';

/**
 * HTTP Server for web client access to MCP tools
 */
export class HTTPServer {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'clickhouse-mcp-server' });
    });

    // List available tools
    this.app.get('/api/tools', (_req: Request, res: Response) => {
      const tools = allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      res.json({ tools });
    });

    // Execute a specific tool
    this.app.post('/api/tools/:name', async (req: Request, res: Response) => {
      const { name } = req.params;
      const args = req.body;

      const tool = toolsMap.get(name);
      if (!tool) {
        res.status(404).json({ error: `Unknown tool: ${name}` });
        return;
      }

      try {
        const result = await tool.handler(args ?? {});
        res.json(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Chat endpoint with AI
    this.app.post('/api/chat', async (req: Request, res: Response) => {
      const { message, history = [], context = {} } = req.body as ChatRequest;

      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        // Build system prompt with context
        const systemPrompt = this.buildSystemPrompt(context);

        // Build message history
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message },
        ];

        // Check if user is asking for specific tools
        const toolRequest = this.detectToolRequest(message);

        if (toolRequest) {
          // Execute tool directly
          sendEvent({ type: 'tool_call', content: `Executing ${toolRequest.name}...`, toolName: toolRequest.name });

          const tool = toolsMap.get(toolRequest.name);
          if (tool) {
            const result = await tool.handler({ ...toolRequest.args, ...context });
            sendEvent({ type: 'tool_result', content: JSON.stringify(result), toolName: toolRequest.name });

            // If result has images, send them
            for (const item of result.content) {
              if (item.type === 'image') {
                sendEvent({
                  type: 'image',
                  content: item.data,
                  mimeType: item.mimeType,
                });
              }
            }
          }
        }

        // Stream AI response
        for await (const chunk of aiProvider.chatStream(messages)) {
          if (chunk.done) {
            sendEvent({ type: 'done', content: '' });
          } else {
            sendEvent({ type: 'text', content: chunk.content });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendEvent({ type: 'error', content: errorMessage });
      } finally {
        res.end();
      }
    });

    // Non-streaming chat endpoint
    this.app.post('/api/chat/sync', async (req: Request, res: Response) => {
      const { message, history = [], context = {} } = req.body as ChatRequest;

      try {
        const systemPrompt = this.buildSystemPrompt(context);

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message },
        ];

        // Check if user is asking for specific tools
        const toolRequest = this.detectToolRequest(message);
        let toolResult = null;

        if (toolRequest) {
          const tool = toolsMap.get(toolRequest.name);
          if (tool) {
            toolResult = await tool.handler({ ...toolRequest.args, ...context });
          }
        }

        const response = await aiProvider.chat(messages);

        res.json({
          message: response.content,
          toolResult,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Quick actions endpoints
    this.app.post('/api/actions/analyze-slow-queries', async (req: Request, res: Response) => {
      const { threshold_ms = 1000, start_time, end_time, limit = 10 } = req.body;

      try {
        const tool = toolsMap.get('analyze_slow_queries');
        if (!tool) {
          res.status(500).json({ error: 'Tool not found' });
          return;
        }

        const result = await tool.handler({ threshold_ms, start_time, end_time, limit });
        res.json(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
      }
    });

    this.app.post('/api/actions/performance-report', async (req: Request, res: Response) => {
      const { start_time, end_time } = req.body;

      try {
        const tool = toolsMap.get('generate_performance_report');
        if (!tool) {
          res.status(500).json({ error: 'Tool not found' });
          return;
        }

        const result = await tool.handler({ start_time, end_time });
        res.json(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
      }
    });
  }

  private buildSystemPrompt(context: Record<string, unknown>): string {
    const availableTools = allTools.map((t) => `- ${t.name}: ${t.description}`).join('\n');

    return `You are a ClickHouse monitoring assistant. You help users analyze query performance, identify slow queries, and optimize their ClickHouse database.

You have access to the following tools:
${availableTools}

Current context:
- Time range: ${context.start_time || 'not specified'} to ${context.end_time || 'not specified'}
- Database filter: ${context.db_name || 'all databases'}

When users ask about query performance, slow queries, or need optimization suggestions, use the appropriate tools to fetch data and provide insights. Be concise and actionable in your responses.`;
  }

  private detectToolRequest(message: string): { name: string; args: Record<string, unknown> } | null {
    const lowerMessage = message.toLowerCase();

    // Detect chart requests
    if (lowerMessage.includes('chart') || lowerMessage.includes('graph') || lowerMessage.includes('visualize')) {
      if (lowerMessage.includes('duration') || lowerMessage.includes('slow')) {
        return { name: 'generate_duration_chart', args: {} };
      }
      if (lowerMessage.includes('memory')) {
        return { name: 'generate_memory_chart', args: {} };
      }
      if (lowerMessage.includes('volume') || lowerMessage.includes('data')) {
        return { name: 'generate_volume_chart', args: {} };
      }
      if (lowerMessage.includes('count') || lowerMessage.includes('queries')) {
        return { name: 'generate_query_count_chart', args: {} };
      }
    }

    // Detect analysis requests
    if (lowerMessage.includes('analyze') && lowerMessage.includes('slow')) {
      return { name: 'analyze_slow_queries', args: {} };
    }

    if (lowerMessage.includes('performance') && (lowerMessage.includes('report') || lowerMessage.includes('summary'))) {
      return { name: 'generate_performance_report', args: {} };
    }

    if (lowerMessage.includes('failed') && lowerMessage.includes('queries')) {
      return { name: 'get_failed_queries', args: {} };
    }

    if (lowerMessage.includes('slow') && lowerMessage.includes('queries')) {
      return { name: 'get_slow_queries', args: {} };
    }

    return null;
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.app.listen(config.port, () => {
        console.log(`ClickHouse MCP HTTP Server running on port ${config.port}`);
        resolve();
      });
    });
  }
}

export async function startHTTPServer() {
  const server = new HTTPServer();
  await server.start();
}
