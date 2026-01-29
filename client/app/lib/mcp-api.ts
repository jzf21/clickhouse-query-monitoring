const MCP_BASE_URL = process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:3001';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatContext {
  start_time?: string;
  end_time?: string;
  db_name?: string;
}

export interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'error' | 'done';
  content: string;
  toolName?: string;
  mimeType?: string;
}

/**
 * Fetch list of available MCP tools
 */
export async function fetchMCPTools(): Promise<MCPTool[]> {
  const response = await fetch(`${MCP_BASE_URL}/api/tools`);

  if (!response.ok) {
    throw new Error(`MCP API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.tools || [];
}

/**
 * Execute a specific MCP tool
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<MCPToolResult> {
  const response = await fetch(`${MCP_BASE_URL}/api/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `MCP API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Send a chat message and receive streaming response
 */
export async function* chatStream(
  message: string,
  history: ChatMessage[] = [],
  context: ChatContext = {}
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${MCP_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history, context }),
  });

  if (!response.ok) {
    throw new Error(`MCP API error: ${response.status} ${response.statusText}`);
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
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      try {
        const parsed = JSON.parse(data) as ChatStreamEvent;
        yield parsed;

        if (parsed.type === 'done') {
          return;
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

/**
 * Send a chat message and receive synchronous response
 */
export async function chatSync(
  message: string,
  history: ChatMessage[] = [],
  context: ChatContext = {}
): Promise<{ message: string; toolResult?: MCPToolResult }> {
  const response = await fetch(`${MCP_BASE_URL}/api/chat/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history, context }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `MCP API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Quick action: Analyze slow queries
 */
export async function analyzeSlowQueries(params: {
  threshold_ms?: number;
  start_time?: string;
  end_time?: string;
  limit?: number;
}): Promise<MCPToolResult> {
  const response = await fetch(`${MCP_BASE_URL}/api/actions/analyze-slow-queries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `MCP API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Quick action: Generate performance report
 */
export async function generatePerformanceReport(params: {
  start_time?: string;
  end_time?: string;
}): Promise<MCPToolResult> {
  const response = await fetch(`${MCP_BASE_URL}/api/actions/performance-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `MCP API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check MCP server health
 */
export async function checkMCPHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${MCP_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`MCP health check failed: ${response.status}`);
  }

  return response.json();
}
