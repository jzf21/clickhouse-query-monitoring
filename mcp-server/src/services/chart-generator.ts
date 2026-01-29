import { config } from '../config.js';
import type { QueryLogMetrics } from '../types/api.js';

export interface ChartOptions {
  title?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

/**
 * Chart generator using QuickChart.io API
 * Returns base64-encoded PNG images
 */
export class ChartGenerator {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? config.quickchartUrl;
  }

  private async fetchChartAsBase64(chartConfig: object): Promise<string> {
    const url = `${this.baseUrl}/chart`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...chartConfig,
        format: 'png',
        encoding: 'base64',
      }),
    });

    if (!response.ok) {
      throw new Error(`QuickChart API error: ${response.status} ${response.statusText}`);
    }

    const base64 = await response.text();
    return `data:image/png;base64,${base64}`;
  }

  /**
   * Generate a query duration chart from metrics data
   */
  async generateDurationChart(
    metrics: QueryLogMetrics[],
    options: ChartOptions = {}
  ): Promise<string> {
    const labels = metrics.map((m) => {
      const date = new Date(m.time_bucket);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    const chartConfig = {
      width: options.width ?? 800,
      height: options.height ?? 400,
      backgroundColor: options.backgroundColor ?? '#1f2937',
      chart: {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Avg Duration (ms)',
              data: metrics.map((m) => m.avg_duration_ms),
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Max Duration (ms)',
              data: metrics.map((m) => m.max_duration_ms),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: false,
              tension: 0.4,
            },
          ],
        },
        options: {
          plugins: {
            title: {
              display: true,
              text: options.title ?? 'Query Duration Over Time',
              color: '#fff',
            },
            legend: {
              labels: { color: '#fff' },
            },
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
              title: {
                display: true,
                text: 'Duration (ms)',
                color: '#9ca3af',
              },
            },
          },
        },
      },
    };

    return this.fetchChartAsBase64(chartConfig);
  }

  /**
   * Generate a memory usage chart from metrics data
   */
  async generateMemoryChart(
    metrics: QueryLogMetrics[],
    options: ChartOptions = {}
  ): Promise<string> {
    const labels = metrics.map((m) => {
      const date = new Date(m.time_bucket);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    // Convert bytes to MB
    const avgMemoryMB = metrics.map((m) => m.avg_memory_usage / 1024 / 1024);
    const maxMemoryMB = metrics.map((m) => m.max_memory_usage / 1024 / 1024);

    const chartConfig = {
      width: options.width ?? 800,
      height: options.height ?? 400,
      backgroundColor: options.backgroundColor ?? '#1f2937',
      chart: {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Avg Memory (MB)',
              data: avgMemoryMB,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Max Memory (MB)',
              data: maxMemoryMB,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fill: false,
              tension: 0.4,
            },
          ],
        },
        options: {
          plugins: {
            title: {
              display: true,
              text: options.title ?? 'Memory Usage Over Time',
              color: '#fff',
            },
            legend: {
              labels: { color: '#fff' },
            },
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
              title: {
                display: true,
                text: 'Memory (MB)',
                color: '#9ca3af',
              },
            },
          },
        },
      },
    };

    return this.fetchChartAsBase64(chartConfig);
  }

  /**
   * Generate a data volume chart from metrics data
   */
  async generateVolumeChart(
    metrics: QueryLogMetrics[],
    options: ChartOptions = {}
  ): Promise<string> {
    const labels = metrics.map((m) => {
      const date = new Date(m.time_bucket);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    // Convert bytes to MB
    const readMB = metrics.map((m) => m.total_read_bytes / 1024 / 1024);
    const writtenMB = metrics.map((m) => m.total_written_bytes / 1024 / 1024);

    const chartConfig = {
      width: options.width ?? 800,
      height: options.height ?? 400,
      backgroundColor: options.backgroundColor ?? '#1f2937',
      chart: {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Data Read (MB)',
              data: readMB,
              backgroundColor: '#22c55e',
            },
            {
              label: 'Data Written (MB)',
              data: writtenMB,
              backgroundColor: '#3b82f6',
            },
          ],
        },
        options: {
          plugins: {
            title: {
              display: true,
              text: options.title ?? 'Data Volume Over Time',
              color: '#fff',
            },
            legend: {
              labels: { color: '#fff' },
            },
          },
          scales: {
            x: {
              stacked: true,
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
            },
            y: {
              stacked: true,
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
              title: {
                display: true,
                text: 'Volume (MB)',
                color: '#9ca3af',
              },
            },
          },
        },
      },
    };

    return this.fetchChartAsBase64(chartConfig);
  }

  /**
   * Generate a query count chart showing total and failed queries
   */
  async generateQueryCountChart(
    metrics: QueryLogMetrics[],
    options: ChartOptions = {}
  ): Promise<string> {
    const labels = metrics.map((m) => {
      const date = new Date(m.time_bucket);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    const chartConfig = {
      width: options.width ?? 800,
      height: options.height ?? 400,
      backgroundColor: options.backgroundColor ?? '#1f2937',
      chart: {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Queries',
              data: metrics.map((m) => m.total_queries),
              backgroundColor: '#3b82f6',
            },
            {
              label: 'Failed Queries',
              data: metrics.map((m) => m.failed_queries),
              backgroundColor: '#ef4444',
            },
          ],
        },
        options: {
          plugins: {
            title: {
              display: true,
              text: options.title ?? 'Query Count Over Time',
              color: '#fff',
            },
            legend: {
              labels: { color: '#fff' },
            },
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' },
              title: {
                display: true,
                text: 'Count',
                color: '#9ca3af',
              },
            },
          },
        },
      },
    };

    return this.fetchChartAsBase64(chartConfig);
  }
}

export const chartGenerator = new ChartGenerator();
