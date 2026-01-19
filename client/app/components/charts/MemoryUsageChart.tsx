'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { QueryLog } from '@/app/lib/api';

interface MemoryUsageChartProps {
  data: QueryLog[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function MemoryUsageChart({ data }: MemoryUsageChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((log) => ({
      time: new Date(log.event_time).toLocaleTimeString(),
      memory: log.memory_usage,
      memoryMB: log.memory_usage / (1024 * 1024),
    }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Memory Usage Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
              tickFormatter={(value) => `${value.toFixed(1)} MB`}
              label={{
                value: 'Memory (MB)',
                angle: -90,
                position: 'insideLeft',
                fill: '#9ca3af',
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fafafa' }}
              formatter={(value: number) => [formatBytes(value * 1024 * 1024), 'Memory']}
            />
            <Area
              type="monotone"
              dataKey="memoryMB"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
