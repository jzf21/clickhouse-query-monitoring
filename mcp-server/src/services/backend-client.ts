import { config } from '../config.js';
import type {
  QueryLogResponse,
  QueryLogFilters,
  QueryLogMetricsResponse,
  MetricsFilters,
} from '../types/api.js';

export class BackendClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? config.backendUrl;
  }

  private buildQueryParams(filters: Record<string, unknown>): URLSearchParams {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean') {
          params.append(key, value ? 'true' : 'false');
        } else {
          params.append(key, String(value));
        }
      }
    }

    return params;
  }

  async getQueryLogs(filters: QueryLogFilters = {}): Promise<QueryLogResponse> {
    const params = this.buildQueryParams(filters);
    const url = `${this.baseUrl}/api/v1/logs${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getQueryLogById(id: string): Promise<QueryLogResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/logs/${encodeURIComponent(id)}`);

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getMetrics(filters: MetricsFilters = {}): Promise<QueryLogMetricsResponse> {
    const params = this.buildQueryParams(filters);
    const url = `${this.baseUrl}/api/v1/logs/metrics${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDatabases(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/databases`);

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.databases || [];
  }

  async getHealth(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  async getReady(): Promise<{ status: string; database: string }> {
    const response = await fetch(`${this.baseUrl}/ready`);

    if (!response.ok) {
      throw new Error(`Ready check failed: ${response.status}`);
    }

    return response.json();
  }
}

export const backendClient = new BackendClient();
