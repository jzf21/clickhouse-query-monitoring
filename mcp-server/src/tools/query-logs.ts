import { z } from 'zod';
import { backendClient } from '../services/backend-client.js';

// Schemas for tool parameters
export const getQueryLogsSchema = z.object({
  db_name: z.string().optional().describe('Filter by database name'),
  user: z.string().optional().describe('Filter by user'),
  min_duration_ms: z.number().optional().describe('Minimum query duration in milliseconds'),
  only_failed: z.boolean().optional().describe('Only show failed queries'),
  only_success: z.boolean().optional().describe('Only show successful queries'),
  query_contains: z.string().optional().describe('Filter queries containing this text'),
  query_kind: z
    .enum(['Select', 'Insert', 'Create', 'Alter', 'Drop'])
    .optional()
    .describe('Filter by query type'),
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
  sort_by: z
    .enum(['event_time', 'memory_usage', 'query_duration_ms', 'read_bytes', 'read_rows'])
    .optional()
    .describe('Sort by field'),
  sort_order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
});

export const getSlowQueriesSchema = z.object({
  threshold_ms: z.number().default(1000).describe('Duration threshold in milliseconds'),
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

export const getFailedQueriesSchema = z.object({
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

// Tool implementations
export async function getQueryLogs(params: z.infer<typeof getQueryLogsSchema>) {
  const response = await backendClient.getQueryLogs({
    ...params,
    columns:
      'query_id,query,event_time,type,user,query_duration_ms,memory_usage,read_rows,exception_code,exception',
  });

  const formattedData = response.data.map((log) => ({
    query_id: log.query_id,
    query: log.query.substring(0, 200) + (log.query.length > 200 ? '...' : ''),
    event_time: log.event_time,
    user: log.user,
    duration_ms: log.query_duration_ms,
    memory_mb: (log.memory_usage / 1024 / 1024).toFixed(2),
    rows_read: log.read_rows.toLocaleString(),
    status: log.exception_code === 0 ? 'success' : 'failed',
    exception: log.exception || null,
  }));

  return {
    content: [
      {
        type: 'text' as const,
        text: `Found ${response.pagination.count} query logs:\n\n${JSON.stringify(formattedData, null, 2)}`,
      },
    ],
  };
}

export async function getSlowQueries(params: z.infer<typeof getSlowQueriesSchema>) {
  const response = await backendClient.getQueryLogs({
    min_duration_ms: params.threshold_ms,
    start_time: params.start_time,
    end_time: params.end_time,
    limit: params.limit,
    sort_by: 'query_duration_ms',
    sort_order: 'desc',
    columns:
      'query_id,query,event_time,user,query_duration_ms,memory_usage,read_rows,read_bytes',
  });

  if (response.data.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `No queries found exceeding ${params.threshold_ms}ms threshold.`,
        },
      ],
    };
  }

  const formattedData = response.data.map((log, i) => ({
    rank: i + 1,
    query_id: log.query_id,
    query: log.query.substring(0, 300) + (log.query.length > 300 ? '...' : ''),
    event_time: log.event_time,
    user: log.user,
    duration_ms: log.query_duration_ms,
    memory_mb: (log.memory_usage / 1024 / 1024).toFixed(2),
    rows_read: log.read_rows.toLocaleString(),
    bytes_read_mb: (log.read_bytes / 1024 / 1024).toFixed(2),
  }));

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Slow Queries (>${params.threshold_ms}ms)\n\nFound ${response.pagination.count} slow queries:\n\n${JSON.stringify(formattedData, null, 2)}`,
      },
    ],
  };
}

export async function getFailedQueries(params: z.infer<typeof getFailedQueriesSchema>) {
  const response = await backendClient.getQueryLogs({
    only_failed: true,
    start_time: params.start_time,
    end_time: params.end_time,
    limit: params.limit,
    sort_by: 'event_time',
    sort_order: 'desc',
    columns: 'query_id,query,event_time,user,exception_code,exception',
  });

  if (response.data.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No failed queries found in the specified time range.',
        },
      ],
    };
  }

  const formattedData = response.data.map((log) => ({
    query_id: log.query_id,
    query: log.query.substring(0, 200) + (log.query.length > 200 ? '...' : ''),
    event_time: log.event_time,
    user: log.user,
    exception_code: log.exception_code,
    exception: log.exception,
  }));

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Failed Queries\n\nFound ${response.pagination.count} failed queries:\n\n${JSON.stringify(formattedData, null, 2)}`,
      },
    ],
  };
}

// Tool definitions for MCP
export const queryLogsTools = [
  {
    name: 'get_query_logs',
    description:
      'Fetch ClickHouse query logs with optional filtering by database, user, duration, status, and time range.',
    inputSchema: {
      type: 'object',
      properties: {
        db_name: { type: 'string', description: 'Filter by database name' },
        user: { type: 'string', description: 'Filter by user' },
        min_duration_ms: {
          type: 'number',
          description: 'Minimum query duration in milliseconds',
        },
        only_failed: { type: 'boolean', description: 'Only show failed queries' },
        only_success: { type: 'boolean', description: 'Only show successful queries' },
        query_contains: {
          type: 'string',
          description: 'Filter queries containing this text',
        },
        query_kind: {
          type: 'string',
          enum: ['Select', 'Insert', 'Create', 'Alter', 'Drop'],
          description: 'Filter by query type',
        },
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        limit: { type: 'number', description: 'Maximum number of results', default: 50 },
        sort_by: {
          type: 'string',
          enum: ['event_time', 'memory_usage', 'query_duration_ms', 'read_bytes', 'read_rows'],
          description: 'Sort by field',
        },
        sort_order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      },
    },
    handler: getQueryLogs,
  },
  {
    name: 'get_slow_queries',
    description:
      'Get the slowest queries that exceed a duration threshold, sorted by duration descending.',
    inputSchema: {
      type: 'object',
      properties: {
        threshold_ms: {
          type: 'number',
          description: 'Duration threshold in milliseconds',
          default: 1000,
        },
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        limit: { type: 'number', description: 'Maximum number of results', default: 20 },
      },
    },
    handler: getSlowQueries,
  },
  {
    name: 'get_failed_queries',
    description: 'Get queries that failed with exceptions, sorted by most recent.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        limit: { type: 'number', description: 'Maximum number of results', default: 20 },
      },
    },
    handler: getFailedQueries,
  },
];
