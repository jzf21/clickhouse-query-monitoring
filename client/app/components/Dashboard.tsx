'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchQueryLogs,
  fetchDatabases,
  fetchQueryLogMetrics,
  QueryLog,
  QueryLogFilters,
  QueryLogMetrics,
  MetricsFilters,
  QueryLogColumnKey,
  getDefaultColumns,
} from '@/app/lib/api';
import StatsCards from './StatsCards';
import QueryDurationChart from './charts/QueryDurationChart';
import MemoryUsageChart from './charts/MemoryUsageChart';
import QueriesByUserChart from './charts/QueriesByUserChart';
import QueryTypeChart from './charts/QueryTypeChart';
import DataVolumeChart from './charts/DataVolumeChart';
import QueryLogsTable from './QueryLogsTable';
import ColumnPicker from './ColumnPicker';

type Tab = 'overview' | 'logs';

export default function Dashboard() {
  const [data, setData] = useState<QueryLog[]>([]);
  const [metricsData, setMetricsData] = useState<QueryLogMetrics[]>([]);
  const [bucketSize, setBucketSize] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Filter state - immediate values for input display
  const [userInput, setUserInput] = useState<string>('');
  // Debounced filter values - used for API calls
  const [debouncedUser, setDebouncedUser] = useState<string>('');
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  // Time filter mode: 'last' for interval, 'custom' for date range
  const [timeMode, setTimeMode] = useState<'last' | 'custom'>('last');
  // Time interval as separate fields
  const [intervalHours, setIntervalHours] = useState<string>('01');
  const [intervalMinutes, setIntervalMinutes] = useState<string>('00');
  const [intervalSeconds, setIntervalSeconds] = useState<string>('00');
  // Custom date range
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Database list for dropdown
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<QueryLogColumnKey[]>(() => {
    // Load from localStorage or use defaults
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queryLogColumns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return getDefaultColumns();
        }
      }
    }
    return getDefaultColumns();
  });

  // Save columns to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('queryLogColumns', JSON.stringify(selectedColumns));
    }
  }, [selectedColumns]);

  // Debounce effect for user input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUser(userInput);
    }, 2000);
    return () => clearTimeout(timer);
  }, [userInput]);

  // Load databases on mount
  useEffect(() => {
    fetchDatabases()
      .then(setDatabases)
      .catch((err) => console.error('Failed to fetch databases:', err));
  }, []);

  // Build time filters based on current mode
  const buildTimeFilters = useCallback(() => {
    const filters: { start_time?: string; end_time?: string } = {};
    if (timeMode === 'last') {
      const hours = parseInt(intervalHours, 10) || 0;
      const minutes = parseInt(intervalMinutes, 10) || 0;
      const seconds = parseInt(intervalSeconds, 10) || 0;
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
      if (totalMs > 0) {
        const startTime = new Date(Date.now() - totalMs);
        filters.start_time = startTime.toISOString();
      }
    } else if (timeMode === 'custom') {
      if (startDate) filters.start_time = new Date(startDate).toISOString();
      if (endDate) filters.end_time = new Date(endDate).toISOString();
    }
    return filters;
  }, [timeMode, intervalHours, intervalMinutes, intervalSeconds, startDate, endDate]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const timeFilters = buildTimeFilters();

      // Build filters for query logs
      const filters: QueryLogFilters = { limit: 100, ...timeFilters };
      if (debouncedUser) filters.user = debouncedUser;
      if (selectedDatabase) filters.db_name = selectedDatabase;
      if (selectedStatus === 'failed') filters.only_failed = true;

      // Build filters for metrics (same base filters)
      const metricsFilters: MetricsFilters = { ...timeFilters };
      if (debouncedUser) metricsFilters.user = debouncedUser;
      if (selectedDatabase) metricsFilters.db_name = selectedDatabase;
      if (selectedStatus === 'failed') metricsFilters.only_failed = true;

      // Fetch both query logs and aggregated metrics in parallel
      const [logsResponse, metricsResponse] = await Promise.all([
        fetchQueryLogs(filters),
        fetchQueryLogMetrics(metricsFilters),
      ]);

      setData(logsResponse.data || []);
      setMetricsData(metricsResponse.data || []);
      setBucketSize(metricsResponse.bucket_size || '');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [debouncedUser, selectedDatabase, selectedStatus, buildTimeFilters]);

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">!</div>
          <p className="mb-4 text-red-500">{error}</p>
          <button
            onClick={loadData}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                ClickHouse Monitor
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Query performance dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-sm text-zinc-500">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              Query Logs
            </button>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="user-filter" className="text-sm text-zinc-600 dark:text-zinc-400">
                User:
              </label>
              <input
                id="user-filter"
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Filter by user"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="db-filter" className="text-sm text-zinc-600 dark:text-zinc-400">
                Database:
              </label>
              <select
                id="db-filter"
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All Databases</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm text-zinc-600 dark:text-zinc-400">
                Status:
              </label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All</option>
                <option value="failed">Failed</option>
                <option value="success">Success</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="time-mode" className="text-sm text-zinc-600 dark:text-zinc-400">
                Time:
              </label>
              <select
                id="time-mode"
                value={timeMode}
                onChange={(e) => setTimeMode(e.target.value as 'last' | 'custom')}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="last">Last</option>
                <option value="custom">Custom Range</option>
              </select>
              {timeMode === 'last' ? (
                <div className="flex items-center gap-1">
                  <input
                    id="interval-hours"
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="HH"
                    className="w-12 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="text-zinc-500">:</span>
                  <input
                    id="interval-minutes"
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="MM"
                    className="w-12 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="text-zinc-500">:</span>
                  <input
                    id="interval-seconds"
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="SS"
                    className="w-12 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              ) : (
                <>
                  <input
                    id="start-date"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="text-xs text-zinc-500">to</span>
                  <input
                    id="end-date"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </>
              )}
            </div>

            <ColumnPicker
              selectedColumns={selectedColumns}
              onColumnsChange={setSelectedColumns}
            />

            {(userInput || selectedDatabase || selectedStatus || intervalHours !== '01' || intervalMinutes !== '00' || intervalSeconds !== '00' || timeMode !== 'last' || startDate || endDate) && (
              <button
                onClick={() => {
                  setUserInput('');
                  setDebouncedUser('');
                  setSelectedDatabase('');
                  setSelectedStatus('');
                  setTimeMode('last');
                  setIntervalHours('01');
                  setIntervalMinutes('00');
                  setIntervalSeconds('00');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                Clear filters
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-4 text-red-500">
            {error}
          </div>
        )}

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <StatsCards data={data} />

            <div className="grid gap-6 lg:grid-cols-2">
              <QueryDurationChart data={metricsData} bucketSize={bucketSize} />
              <MemoryUsageChart data={metricsData} bucketSize={bucketSize} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <QueriesByUserChart data={data} />
              <QueryTypeChart data={data} />
            </div>

            <DataVolumeChart data={metricsData} bucketSize={bucketSize} />
          </div>
        ) : (
          <QueryLogsTable data={data} selectedColumns={selectedColumns} />
        )}
      </div>
    </div>
  );
}
