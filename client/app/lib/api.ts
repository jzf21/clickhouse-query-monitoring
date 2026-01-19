const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
  min_duration_ms?: number;
  user?: string;
  query_contains?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
}

export async function fetchQueryLogs(filters: QueryLogFilters = {}): Promise<QueryLogResponse> {
  const params = new URLSearchParams();

  if (filters.db_name) params.append('db_name', filters.db_name);
  if (filters.query_id) params.append('query_id', filters.query_id);
  if (filters.only_failed) params.append('only_failed', 'true');
  if (filters.min_duration_ms) params.append('min_duration_ms', filters.min_duration_ms.toString());
  if (filters.user) params.append('user', filters.user);
  if (filters.query_contains) params.append('query_contains', filters.query_contains);
  if (filters.start_time) params.append('start_time', filters.start_time);
  if (filters.end_time) params.append('end_time', filters.end_time);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const url = `${API_BASE_URL}/api/v1/logs${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchHealthStatus(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchReadyStatus(): Promise<{ status: string; database: string }> {
  const response = await fetch(`${API_BASE_URL}/ready`);

  if (!response.ok) {
    throw new Error(`Ready check failed: ${response.status}`);
  }

  return response.json();
}
