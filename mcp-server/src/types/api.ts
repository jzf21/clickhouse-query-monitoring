// Types reused from client/app/lib/api.ts

export interface QueryLog {
  query_id: string;
  query: string;
  event_time: string;
  event_date: string;
  type: string;
  query_duration_ms: number;
  memory_usage: number;
  read_rows: number;
  read_bytes: number;
  written_rows: number;
  written_bytes: number;
  result_rows: number;
  result_bytes: number;
  databases: string[];
  tables: string[];
  exception_code: number;
  exception: string;
  user: string;
  client_hostname: string;
  http_user_agent: string;
  initial_user: string;
  initial_query_id: string;
  is_initial_query: number;
}

export interface QueryLogResponse {
  data: QueryLog[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

export interface QueryLogFilters {
  db_name?: string;
  query_id?: string;
  only_failed?: boolean;
  only_success?: boolean;
  min_duration_ms?: number;
  user?: string;
  query_contains?: string;
  query_kind?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
  columns?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface QueryLogMetrics {
  time_bucket: string;
  total_queries: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  avg_memory_usage: number;
  max_memory_usage: number;
  total_read_bytes: number;
  total_written_bytes: number;
  failed_queries: number;
}

export interface QueryLogMetricsResponse {
  data: QueryLogMetrics[];
  bucket_size: string;
  bucket_label: string;
}

export interface MetricsFilters {
  db_name?: string;
  only_failed?: boolean;
  only_success?: boolean;
  min_duration_ms?: number;
  user?: string;
  query_contains?: string;
  start_time?: string;
  end_time?: string;
}

// MCP-specific types

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  context?: {
    start_time?: string;
    end_time?: string;
    db_name?: string;
  };
}

export interface ChatResponseChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'error' | 'done';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  image?: string; // base64 encoded image
}
