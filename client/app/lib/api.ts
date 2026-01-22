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
  only_success?: boolean;
  min_duration_ms?: number;
  user?: string;
  query_contains?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
  columns?: string; // Comma-separated list of columns to return
}

// Column configuration for the query logs table
export const QUERY_LOG_COLUMNS = [
  { key: 'query_id', label: 'Query ID', default: false },
  { key: 'query', label: 'Query', default: true },
  { key: 'event_time', label: 'Time', default: true },
  { key: 'event_date', label: 'Date', default: false },
  { key: 'type', label: 'Type', default: true },
  { key: 'user', label: 'User', default: true },
  { key: 'query_duration_ms', label: 'Duration', default: true },
  { key: 'memory_usage', label: 'Memory', default: true },
  { key: 'read_rows', label: 'Rows Read', default: true },
  { key: 'read_bytes', label: 'Bytes Read', default: false },
  { key: 'written_rows', label: 'Rows Written', default: false },
  { key: 'written_bytes', label: 'Bytes Written', default: false },
  { key: 'result_rows', label: 'Result Rows', default: false },
  { key: 'result_bytes', label: 'Result Bytes', default: false },
  { key: 'databases', label: 'Databases', default: false },
  { key: 'tables', label: 'Tables', default: false },
  { key: 'exception_code', label: 'Exception Code', default: true },
  { key: 'exception', label: 'Exception', default: false },
  { key: 'client_hostname', label: 'Client Host', default: false },
  { key: 'http_user_agent', label: 'User Agent', default: false },
  { key: 'initial_user', label: 'Initial User', default: false },
  { key: 'initial_query_id', label: 'Initial Query ID', default: false },
  { key: 'is_initial_query', label: 'Is Initial', default: false },
] as const;

export type QueryLogColumnKey = (typeof QUERY_LOG_COLUMNS)[number]['key'];

// Get default columns
export function getDefaultColumns(): QueryLogColumnKey[] {
  return QUERY_LOG_COLUMNS.filter((col) => col.default).map((col) => col.key);
}

export async function fetchQueryLogs(filters: QueryLogFilters = {}): Promise<QueryLogResponse> {
  const params = new URLSearchParams();

  if (filters.db_name) params.append('db_name', filters.db_name);
  if (filters.query_id) params.append('query_id', filters.query_id);
  if (filters.only_failed) params.append('only_failed', 'true');
  if (filters.only_success) params.append('only_success', 'true');
  if (filters.min_duration_ms) params.append('min_duration_ms', filters.min_duration_ms.toString());
  if (filters.user) params.append('user', filters.user);
  if (filters.query_contains) params.append('query_contains', filters.query_contains);
  if (filters.start_time) params.append('start_time', filters.start_time);
  if (filters.end_time) params.append('end_time', filters.end_time);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());
  if (filters.columns) params.append('columns', filters.columns);

  const url = `${API_BASE_URL}/api/v1/logs${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchDatabases(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/databases`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.databases || [];
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

// Aggregated metrics for charts
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

export async function fetchQueryLogMetrics(filters: MetricsFilters = {}): Promise<QueryLogMetricsResponse> {
  const params = new URLSearchParams();

  if (filters.db_name) params.append('db_name', filters.db_name);
  if (filters.only_failed) params.append('only_failed', 'true');
  if (filters.only_success) params.append('only_success', 'true');
  if (filters.min_duration_ms) params.append('min_duration_ms', filters.min_duration_ms.toString());
  if (filters.user) params.append('user', filters.user);
  if (filters.query_contains) params.append('query_contains', filters.query_contains);
  if (filters.start_time) params.append('start_time', filters.start_time);
  if (filters.end_time) params.append('end_time', filters.end_time);

  const url = `${API_BASE_URL}/api/v1/logs/metrics${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface ExportFilters extends MetricsFilters {
  columns: string; // Required comma-separated list of columns
  limit?: number;
}

export function getExportUrl(filters: ExportFilters): string {
  const params = new URLSearchParams();

  params.append('columns', filters.columns);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.db_name) params.append('db_name', filters.db_name);
  if (filters.only_failed) params.append('only_failed', 'true');
  if (filters.only_success) params.append('only_success', 'true');
  if (filters.min_duration_ms) params.append('min_duration_ms', filters.min_duration_ms.toString());
  if (filters.user) params.append('user', filters.user);
  if (filters.query_contains) params.append('query_contains', filters.query_contains);
  if (filters.start_time) params.append('start_time', filters.start_time);
  if (filters.end_time) params.append('end_time', filters.end_time);

  return `${API_BASE_URL}/api/v1/logs/export?${params.toString()}`;
}
