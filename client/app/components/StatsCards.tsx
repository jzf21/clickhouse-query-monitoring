'use client';

import { QueryLog } from '@/app/lib/api';

interface StatsCardsProps {
  data: QueryLog[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60000).toFixed(2)} min`;
}

export default function StatsCards({ data }: StatsCardsProps) {
  const totalQueries = data.length;
  const avgDuration =
    totalQueries > 0
      ? data.reduce((sum, log) => sum + log.query_duration_ms, 0) / totalQueries
      : 0;
  const totalMemory = data.reduce((sum, log) => sum + log.memory_usage, 0);
  const failedQueries = data.filter(
    (log) => log.type.includes('Exception') || log.exception_code !== 0
  ).length;
  const totalBytesRead = data.reduce((sum, log) => sum + log.read_bytes, 0);

  const stats = [
    {
      label: 'Total Queries',
      value: totalQueries.toLocaleString(),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(avgDuration),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Total Memory',
      value: formatBytes(totalMemory),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Failed Queries',
      value: failedQueries.toLocaleString(),
      color: failedQueries > 0 ? 'text-red-500' : 'text-green-500',
      bgColor: failedQueries > 0 ? 'bg-red-500/10' : 'bg-green-500/10',
    },
    {
      label: 'Data Read',
      value: formatBytes(totalBytesRead),
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 ${stat.bgColor}`}
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
