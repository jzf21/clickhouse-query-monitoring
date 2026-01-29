import { z } from 'zod';
import { backendClient } from '../services/backend-client.js';
import { aiProvider } from '../services/ai-provider.js';

// Schemas for tool parameters
export const analyzeSlowQueriesSchema = z.object({
  threshold_ms: z.number().default(1000).describe('Duration threshold in milliseconds'),
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
  limit: z.number().optional().default(10).describe('Maximum number of queries to analyze'),
});

export const suggestQueryOptimizationSchema = z.object({
  query: z.string().describe('The SQL query to optimize'),
});

export const generatePerformanceReportSchema = z.object({
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
});

// Tool implementations
export async function analyzeSlowQueries(params: z.infer<typeof analyzeSlowQueriesSchema>) {
  // Fetch slow queries from backend
  const response = await backendClient.getQueryLogs({
    min_duration_ms: params.threshold_ms,
    start_time: params.start_time,
    end_time: params.end_time,
    limit: params.limit,
    sort_by: 'query_duration_ms',
    sort_order: 'desc',
    columns: 'query_id,query,query_duration_ms,memory_usage,read_rows,read_bytes',
  });

  if (response.data.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `No queries found exceeding ${params.threshold_ms}ms threshold in the specified time range.`,
        },
      ],
    };
  }

  // Use AI to analyze the queries
  const analysis = await aiProvider.analyzeSlowQueries(
    response.data.map((q) => ({
      query: q.query,
      duration_ms: q.query_duration_ms,
      memory_usage: q.memory_usage,
      read_rows: q.read_rows,
    }))
  );

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Slow Query Analysis\n\n**Analyzed ${response.data.length} queries exceeding ${params.threshold_ms}ms**\n\n${analysis}`,
      },
    ],
  };
}

export async function suggestQueryOptimization(
  params: z.infer<typeof suggestQueryOptimizationSchema>
) {
  const suggestions = await aiProvider.suggestQueryOptimization(params.query);

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Query Optimization Suggestions\n\n**Original Query:**\n\`\`\`sql\n${params.query}\n\`\`\`\n\n${suggestions}`,
      },
    ],
  };
}

export async function generatePerformanceReport(
  params: z.infer<typeof generatePerformanceReportSchema>
) {
  // Fetch metrics
  const metricsResponse = await backendClient.getMetrics({
    start_time: params.start_time,
    end_time: params.end_time,
  });

  if (metricsResponse.data.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No metrics data found for the specified time range.',
        },
      ],
    };
  }

  // Calculate summary
  const totalQueries = metricsResponse.data.reduce((sum, m) => sum + m.total_queries, 0);
  const totalFailed = metricsResponse.data.reduce((sum, m) => sum + m.failed_queries, 0);
  const avgDuration =
    metricsResponse.data.reduce((sum, m) => sum + m.avg_duration_ms, 0) /
    metricsResponse.data.length;
  const maxDuration = Math.max(...metricsResponse.data.map((m) => m.max_duration_ms));
  const totalReadBytes = metricsResponse.data.reduce((sum, m) => sum + m.total_read_bytes, 0);

  const timeRange = `${metricsResponse.data[0]?.time_bucket} to ${metricsResponse.data[metricsResponse.data.length - 1]?.time_bucket}`;

  // Use AI to generate insights
  const summary = await aiProvider.generatePerformanceSummary({
    totalQueries,
    avgDuration,
    maxDuration,
    failedQueries: totalFailed,
    totalReadBytes,
    timeRange,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Performance Report\n\n**Time Range:** ${timeRange}\n**Bucket Size:** ${metricsResponse.bucket_label}\n\n### Statistics\n- Total Queries: ${totalQueries.toLocaleString()}\n- Failed Queries: ${totalFailed.toLocaleString()} (${((totalFailed / totalQueries) * 100).toFixed(2)}%)\n- Average Duration: ${avgDuration.toFixed(2)}ms\n- Max Duration: ${maxDuration.toFixed(2)}ms\n- Data Read: ${(totalReadBytes / 1024 / 1024 / 1024).toFixed(2)} GB\n\n### AI Analysis\n\n${summary}`,
      },
    ],
  };
}

// Tool definitions for MCP
export const analysisTools = [
  {
    name: 'analyze_slow_queries',
    description:
      'Use AI to analyze slow queries and provide optimization suggestions. Identifies patterns and recommends improvements.',
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
        limit: {
          type: 'number',
          description: 'Maximum number of queries to analyze',
          default: 10,
        },
      },
    },
    handler: analyzeSlowQueries,
  },
  {
    name: 'suggest_query_optimization',
    description:
      'Use AI to analyze a specific ClickHouse query and suggest optimizations, indexes, and best practices.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The SQL query to optimize' },
      },
      required: ['query'],
    },
    handler: suggestQueryOptimization,
  },
  {
    name: 'generate_performance_report',
    description:
      'Generate an AI-powered performance report with insights and recommendations based on query metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
      },
    },
    handler: generatePerformanceReport,
  },
];
