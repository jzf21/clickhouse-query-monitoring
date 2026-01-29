import { z } from 'zod';
import { backendClient } from '../services/backend-client.js';

// Schema for tool parameters
export const getMetricsSchema = z.object({
  db_name: z.string().optional().describe('Filter by database name'),
  user: z.string().optional().describe('Filter by user'),
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
});

export const getDatabasesSchema = z.object({});

// Tool implementations
export async function getMetrics(params: z.infer<typeof getMetricsSchema>) {
  const response = await backendClient.getMetrics({
    db_name: params.db_name,
    user: params.user,
    start_time: params.start_time,
    end_time: params.end_time,
  });

  if (response.data.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No metrics data found for the specified time range.',
        },
      ],
    };
  }

  // Calculate summary statistics
  const totalQueries = response.data.reduce((sum, m) => sum + m.total_queries, 0);
  const totalFailed = response.data.reduce((sum, m) => sum + m.failed_queries, 0);
  const avgDuration =
    response.data.reduce((sum, m) => sum + m.avg_duration_ms, 0) / response.data.length;
  const maxDuration = Math.max(...response.data.map((m) => m.max_duration_ms));
  const totalReadBytes = response.data.reduce((sum, m) => sum + m.total_read_bytes, 0);
  const totalWrittenBytes = response.data.reduce((sum, m) => sum + m.total_written_bytes, 0);

  const summary = {
    time_range: {
      start: response.data[0]?.time_bucket,
      end: response.data[response.data.length - 1]?.time_bucket,
      bucket_size: response.bucket_label,
    },
    overview: {
      total_queries: totalQueries,
      failed_queries: totalFailed,
      failure_rate: ((totalFailed / totalQueries) * 100).toFixed(2) + '%',
    },
    duration: {
      average_ms: avgDuration.toFixed(2),
      max_ms: maxDuration.toFixed(2),
    },
    data_volume: {
      total_read_gb: (totalReadBytes / 1024 / 1024 / 1024).toFixed(2),
      total_written_gb: (totalWrittenBytes / 1024 / 1024 / 1024).toFixed(2),
    },
    data_points: response.data.length,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: `## ClickHouse Metrics Summary\n\n${JSON.stringify(summary, null, 2)}\n\n### Time Series Data (${response.data.length} buckets)\n\n${JSON.stringify(
          response.data.slice(0, 10).map((m) => ({
            time: m.time_bucket,
            queries: m.total_queries,
            avg_duration_ms: m.avg_duration_ms.toFixed(2),
            failed: m.failed_queries,
          })),
          null,
          2
        )}${response.data.length > 10 ? `\n\n... and ${response.data.length - 10} more data points` : ''}`,
      },
    ],
  };
}

export async function getDatabases() {
  const databases = await backendClient.getDatabases();

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Available Databases\n\nFound ${databases.length} databases:\n\n${databases.map((db) => `- ${db}`).join('\n')}`,
      },
    ],
  };
}

// Tool definitions for MCP
export const metricsTools = [
  {
    name: 'get_metrics',
    description:
      'Get aggregated performance metrics for ClickHouse queries over a time range. Returns summary statistics and time-bucketed data.',
    inputSchema: {
      type: 'object',
      properties: {
        db_name: { type: 'string', description: 'Filter by database name' },
        user: { type: 'string', description: 'Filter by user' },
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
      },
    },
    handler: getMetrics,
  },
  {
    name: 'get_databases',
    description: 'List all available databases in ClickHouse.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: getDatabases,
  },
];
