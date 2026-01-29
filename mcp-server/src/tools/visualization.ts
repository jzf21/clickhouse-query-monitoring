import { z } from 'zod';
import { backendClient } from '../services/backend-client.js';
import { chartGenerator } from '../services/chart-generator.js';

// Schemas for tool parameters
export const generateChartSchema = z.object({
  start_time: z.string().optional().describe('Start time (ISO 8601 format)'),
  end_time: z.string().optional().describe('End time (ISO 8601 format)'),
  db_name: z.string().optional().describe('Filter by database name'),
  title: z.string().optional().describe('Custom chart title'),
});

// Tool implementations
export async function generateDurationChart(params: z.infer<typeof generateChartSchema>) {
  const metricsResponse = await backendClient.getMetrics({
    start_time: params.start_time,
    end_time: params.end_time,
    db_name: params.db_name,
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

  const chartImage = await chartGenerator.generateDurationChart(metricsResponse.data, {
    title: params.title ?? 'Query Duration Over Time',
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Query Duration Chart\n\nTime range: ${metricsResponse.data[0]?.time_bucket} to ${metricsResponse.data[metricsResponse.data.length - 1]?.time_bucket}\nBucket size: ${metricsResponse.bucket_label}\nData points: ${metricsResponse.data.length}`,
      },
      {
        type: 'image' as const,
        data: chartImage.replace('data:image/png;base64,', ''),
        mimeType: 'image/png',
      },
    ],
  };
}

export async function generateMemoryChart(params: z.infer<typeof generateChartSchema>) {
  const metricsResponse = await backendClient.getMetrics({
    start_time: params.start_time,
    end_time: params.end_time,
    db_name: params.db_name,
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

  const chartImage = await chartGenerator.generateMemoryChart(metricsResponse.data, {
    title: params.title ?? 'Memory Usage Over Time',
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Memory Usage Chart\n\nTime range: ${metricsResponse.data[0]?.time_bucket} to ${metricsResponse.data[metricsResponse.data.length - 1]?.time_bucket}\nBucket size: ${metricsResponse.bucket_label}\nData points: ${metricsResponse.data.length}`,
      },
      {
        type: 'image' as const,
        data: chartImage.replace('data:image/png;base64,', ''),
        mimeType: 'image/png',
      },
    ],
  };
}

export async function generateVolumeChart(params: z.infer<typeof generateChartSchema>) {
  const metricsResponse = await backendClient.getMetrics({
    start_time: params.start_time,
    end_time: params.end_time,
    db_name: params.db_name,
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

  const chartImage = await chartGenerator.generateVolumeChart(metricsResponse.data, {
    title: params.title ?? 'Data Volume Over Time',
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Data Volume Chart\n\nTime range: ${metricsResponse.data[0]?.time_bucket} to ${metricsResponse.data[metricsResponse.data.length - 1]?.time_bucket}\nBucket size: ${metricsResponse.bucket_label}\nData points: ${metricsResponse.data.length}`,
      },
      {
        type: 'image' as const,
        data: chartImage.replace('data:image/png;base64,', ''),
        mimeType: 'image/png',
      },
    ],
  };
}

export async function generateQueryCountChart(params: z.infer<typeof generateChartSchema>) {
  const metricsResponse = await backendClient.getMetrics({
    start_time: params.start_time,
    end_time: params.end_time,
    db_name: params.db_name,
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

  const chartImage = await chartGenerator.generateQueryCountChart(metricsResponse.data, {
    title: params.title ?? 'Query Count Over Time',
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Query Count Chart\n\nTime range: ${metricsResponse.data[0]?.time_bucket} to ${metricsResponse.data[metricsResponse.data.length - 1]?.time_bucket}\nBucket size: ${metricsResponse.bucket_label}\nData points: ${metricsResponse.data.length}`,
      },
      {
        type: 'image' as const,
        data: chartImage.replace('data:image/png;base64,', ''),
        mimeType: 'image/png',
      },
    ],
  };
}

// Tool definitions for MCP
export const visualizationTools = [
  {
    name: 'generate_duration_chart',
    description:
      'Generate a chart showing query duration (avg and max) over time. Returns a PNG image.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        db_name: { type: 'string', description: 'Filter by database name' },
        title: { type: 'string', description: 'Custom chart title' },
      },
    },
    handler: generateDurationChart,
  },
  {
    name: 'generate_memory_chart',
    description:
      'Generate a chart showing memory usage (avg and max) over time. Returns a PNG image.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        db_name: { type: 'string', description: 'Filter by database name' },
        title: { type: 'string', description: 'Custom chart title' },
      },
    },
    handler: generateMemoryChart,
  },
  {
    name: 'generate_volume_chart',
    description:
      'Generate a stacked bar chart showing data read and written over time. Returns a PNG image.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        db_name: { type: 'string', description: 'Filter by database name' },
        title: { type: 'string', description: 'Custom chart title' },
      },
    },
    handler: generateVolumeChart,
  },
  {
    name: 'generate_query_count_chart',
    description:
      'Generate a bar chart showing total and failed query counts over time. Returns a PNG image.',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Start time (ISO 8601 format)' },
        end_time: { type: 'string', description: 'End time (ISO 8601 format)' },
        db_name: { type: 'string', description: 'Filter by database name' },
        title: { type: 'string', description: 'Custom chart title' },
      },
    },
    handler: generateQueryCountChart,
  },
];
