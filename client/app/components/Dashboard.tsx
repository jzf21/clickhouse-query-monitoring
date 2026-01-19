'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchQueryLogs, QueryLog, QueryLogFilters } from '@/app/lib/api';
import StatsCards from './StatsCards';
import QueryDurationChart from './charts/QueryDurationChart';
import MemoryUsageChart from './charts/MemoryUsageChart';
import QueriesByUserChart from './charts/QueriesByUserChart';
import QueryTypeChart from './charts/QueryTypeChart';
import DataVolumeChart from './charts/DataVolumeChart';
import QueryLogsTable from './QueryLogsTable';

type Tab = 'overview' | 'logs';

export default function Dashboard() {
  const [data, setData] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Filter state
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: QueryLogFilters = { limit: 100 };
      if (selectedUser) filters.user = selectedUser;
      if (selectedDatabase) filters.db_name = selectedDatabase;
      if (startDate) filters.start_time = new Date(startDate).toISOString();
      if (endDate) filters.end_time = new Date(endDate).toISOString();
      const response = await fetchQueryLogs(filters);
      setData(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, selectedDatabase, startDate, endDate]);

  // Extract unique users and databases from data for filter options
  const { users, databases } = useMemo(() => {
    const userSet = new Set<string>();
    const dbSet = new Set<string>();
    data.forEach((log) => {
      if (log.user) userSet.add(log.user);
      if (log.databases) {
        log.databases.forEach((db) => dbSet.add(db));
      }
    });
    return {
      users: Array.from(userSet).sort(),
      databases: Array.from(dbSet).sort(),
    };
  }, [data]);

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
              <select
                id="user-filter"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
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
              <label htmlFor="start-date" className="text-sm text-zinc-600 dark:text-zinc-400">
                From:
              </label>
              <input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm text-zinc-600 dark:text-zinc-400">
                To:
              </label>
              <input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {(selectedUser || selectedDatabase || startDate || endDate) && (
              <button
                onClick={() => {
                  setSelectedUser('');
                  setSelectedDatabase('');
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
              <QueryDurationChart data={data} />
              <MemoryUsageChart data={data} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <QueriesByUserChart data={data} />
              <QueryTypeChart data={data} />
            </div>

            <DataVolumeChart data={data} />
          </div>
        ) : (
          <QueryLogsTable data={data} />
        )}
      </div>
    </div>
  );
}
