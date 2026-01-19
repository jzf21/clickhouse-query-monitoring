'use client';

import { useState } from 'react';
import { QueryLog } from '@/app/lib/api';

interface QueryLogsTableProps {
  data: QueryLog[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60000).toFixed(2)} min`;
}

function truncateQuery(query: string, maxLength: number = 100): string {
  if (query.length <= maxLength) return query;
  return query.substring(0, maxLength) + '...';
}

export default function QueryLogsTable({ data }: QueryLogsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof QueryLog>('event_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof QueryLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: keyof QueryLog }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-zinc-400">↕</span>;
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const getStatusBadge = (log: QueryLog) => {
    if (log.exception_code !== 0 || log.type.includes('Exception')) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Failed
        </span>
      );
    }
    if (log.type === 'QueryFinish') {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Success
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        {log.type}
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleSort('event_time')}
              >
                Time <SortIcon field="event_time" />
              </th>
              <th className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                Status
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleSort('user')}
              >
                User <SortIcon field="user" />
              </th>
              <th className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                Query
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleSort('query_duration_ms')}
              >
                Duration <SortIcon field="query_duration_ms" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleSort('memory_usage')}
              >
                Memory <SortIcon field="memory_usage" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleSort('read_rows')}
              >
                Rows Read <SortIcon field="read_rows" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sortedData.map((log) => (
              <>
                <tr
                  key={log.query_id}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={() => setExpandedRow(expandedRow === log.query_id ? null : log.query_id)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(log.event_time).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(log)}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {log.user}
                  </td>
                  <td className="max-w-md px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {truncateQuery(log.query)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {formatDuration(log.query_duration_ms)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {formatBytes(log.memory_usage)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {log.read_rows.toLocaleString()}
                  </td>
                </tr>
                {expandedRow === log.query_id && (
                  <tr key={`${log.query_id}-expanded`} className="bg-zinc-50 dark:bg-zinc-800/30">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Full Query
                          </h4>
                          <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                            {log.query}
                          </pre>
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div>
                            <span className="text-xs text-zinc-500">Query ID</span>
                            <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                              {log.query_id}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Type</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">{log.type}</p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Databases</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {log.databases?.join(', ') || '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Tables</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {log.tables?.join(', ') || '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Read Bytes</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {formatBytes(log.read_bytes)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Written Rows</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {log.written_rows.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Result Rows</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {log.result_rows.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Client</span>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {log.client_hostname || '-'}
                            </p>
                          </div>
                        </div>
                        {log.exception && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium text-red-600">
                              Exception (Code: {log.exception_code})
                            </h4>
                            <pre className="max-h-32 overflow-auto rounded-lg bg-red-50 p-3 font-mono text-xs text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              {log.exception}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="py-12 text-center text-zinc-500">
          No query logs found matching the current filters.
        </div>
      )}
    </div>
  );
}
