'use client';

import { Fragment, useState, useEffect } from 'react';
import { QueryLog, QueryLogColumnKey, QUERY_LOG_COLUMNS } from '@/app/lib/api';

interface QueryLogsTableProps {
  data: QueryLog[];
  selectedColumns?: QueryLogColumnKey[];
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

type StatusFilter = 'all' | 'success' | 'failed' | 'running';

function getQueryStatus(log: QueryLog): 'success' | 'failed' | 'running' {
  if (log.exception_code !== 0 || log.type.includes('Exception')) {
    return 'failed';
  }
  if (log.type === 'QueryFinish') {
    return 'success';
  }
  return 'running';
}

// Column configuration for rendering
const columnConfig: Record<
  QueryLogColumnKey,
  {
    label: string;
    sortable: boolean;
    render: (log: QueryLog) => React.ReactNode;
    className?: string;
  }
> = {
  query_id: {
    label: 'Query ID',
    sortable: true,
    render: (log) => <span className="font-mono text-xs">{log.query_id.slice(0, 8)}...</span>,
  },
  query: {
    label: 'Query',
    sortable: false,
    render: (log) => (
      <span className="font-mono text-xs">{truncateQuery(log.query)}</span>
    ),
    className: 'max-w-md',
  },
  event_time: {
    label: 'Time',
    sortable: true,
    render: (log) => new Date(log.event_time).toLocaleString(),
    className: 'whitespace-nowrap',
  },
  event_date: {
    label: 'Date',
    sortable: true,
    render: (log) => new Date(log.event_date).toLocaleDateString(),
    className: 'whitespace-nowrap',
  },
  type: {
    label: 'Status',
    sortable: false,
    render: (log) => getStatusBadgeElement(log),
  },
  user: {
    label: 'User',
    sortable: true,
    render: (log) => log.user,
  },
  query_duration_ms: {
    label: 'Duration',
    sortable: true,
    render: (log) => formatDuration(log.query_duration_ms),
    className: 'whitespace-nowrap',
  },
  memory_usage: {
    label: 'Memory',
    sortable: true,
    render: (log) => formatBytes(log.memory_usage),
    className: 'whitespace-nowrap',
  },
  read_rows: {
    label: 'Rows Read',
    sortable: true,
    render: (log) => log.read_rows.toLocaleString(),
    className: 'whitespace-nowrap',
  },
  read_bytes: {
    label: 'Bytes Read',
    sortable: true,
    render: (log) => formatBytes(log.read_bytes),
    className: 'whitespace-nowrap',
  },
  written_rows: {
    label: 'Rows Written',
    sortable: true,
    render: (log) => log.written_rows.toLocaleString(),
    className: 'whitespace-nowrap',
  },
  written_bytes: {
    label: 'Bytes Written',
    sortable: true,
    render: (log) => formatBytes(log.written_bytes),
    className: 'whitespace-nowrap',
  },
  result_rows: {
    label: 'Result Rows',
    sortable: true,
    render: (log) => log.result_rows.toLocaleString(),
    className: 'whitespace-nowrap',
  },
  result_bytes: {
    label: 'Result Bytes',
    sortable: true,
    render: (log) => formatBytes(log.result_bytes),
    className: 'whitespace-nowrap',
  },
  databases: {
    label: 'Databases',
    sortable: false,
    render: (log) => log.databases?.join(', ') || '-',
  },
  tables: {
    label: 'Tables',
    sortable: false,
    render: (log) => log.tables?.join(', ') || '-',
  },
  exception_code: {
    label: 'Exc Code',
    sortable: true,
    render: (log) => (log.exception_code !== 0 ? log.exception_code : '-'),
  },
  exception: {
    label: 'Exception',
    sortable: false,
    render: (log) => (log.exception ? truncateQuery(log.exception, 50) : '-'),
    className: 'max-w-xs',
  },
  client_hostname: {
    label: 'Client Host',
    sortable: true,
    render: (log) => log.client_hostname || '-',
  },
  http_user_agent: {
    label: 'User Agent',
    sortable: false,
    render: (log) => (log.http_user_agent ? truncateQuery(log.http_user_agent, 30) : '-'),
    className: 'max-w-xs',
  },
  initial_user: {
    label: 'Initial User',
    sortable: true,
    render: (log) => log.initial_user || '-',
  },
  initial_query_id: {
    label: 'Initial Query ID',
    sortable: true,
    render: (log) =>
      log.initial_query_id ? <span className="font-mono text-xs">{log.initial_query_id.slice(0, 8)}...</span> : '-',
  },
  is_initial_query: {
    label: 'Is Initial',
    sortable: true,
    render: (log) => (log.is_initial_query ? 'Yes' : 'No'),
  },
};

function getStatusBadgeElement(log: QueryLog): React.ReactNode {
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
}

const ITEMS_PER_PAGE = 50;

export default function QueryLogsTable({ data, selectedColumns }: QueryLogsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof QueryLog>('event_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when data changes (e.g., on refresh)
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // Get columns to display - use selectedColumns if provided, otherwise show default columns
  const columnsToDisplay: QueryLogColumnKey[] = selectedColumns?.length
    ? selectedColumns
    : QUERY_LOG_COLUMNS.filter((c) => c.default).map((c) => c.key);

  const handleSort = (field: keyof QueryLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredData = data.filter((log) => {
    if (statusFilter === 'all') return true;
    return getQueryStatus(log) === statusFilter;
  });

  const sortedData = [...filteredData].sort((a, b) => {
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

  // Pagination calculations
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: keyof QueryLog }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-zinc-400">↕</span>;
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sort:
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-') as [keyof QueryLog, 'asc' | 'desc'];
              setSortField(field);
              setSortDirection(direction);
              setCurrentPage(1);
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="event_time-desc">Recent</option>
            <option value="memory_usage-desc">Top Memory</option>
            <option value="query_duration_ms-desc">Slowest</option>
            <option value="read_bytes-desc">Most Read</option>
          </select>
        </label>
        <span className="text-sm text-zinc-500">
          {filteredData.length} of {data.length} queries
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              {columnsToDisplay.map((colKey) => {
                const config = columnConfig[colKey];
                return (
                  <th
                    key={colKey}
                    className={`px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 ${
                      config.sortable
                        ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        : ''
                    }`}
                    onClick={() => config.sortable && handleSort(colKey as keyof QueryLog)}
                  >
                    {config.label}
                    {config.sortable && <SortIcon field={colKey as keyof QueryLog} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {paginatedData.map((log, index) => {
              const rowKey = `${log.query_id}-${log.type}-${startIndex + index}`;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => setExpandedRow(expandedRow === rowKey ? null : rowKey)}
                  >
                    {columnsToDisplay.map((colKey) => {
                      const config = columnConfig[colKey];
                      return (
                        <td
                          key={colKey}
                          className={`px-4 py-3 text-zinc-900 dark:text-zinc-100 ${config.className || ''}`}
                        >
                          {config.render(log)}
                        </td>
                      );
                    })}
                  </tr>
                  {expandedRow === rowKey && (
                    <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                      <td colSpan={columnsToDisplay.length} className="px-4 py-4">
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
              </Fragment>
            );
            })}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="py-12 text-center text-zinc-500">
          No query logs found matching the current filters.
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first, last, current, and pages around current
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, idx, arr) => (
                  <Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-zinc-400">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2rem] rounded-md px-2 py-1 text-sm ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {page}
                    </button>
                  </Fragment>
                ))}
            </div>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
