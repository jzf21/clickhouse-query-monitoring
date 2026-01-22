'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { QueryLogMetrics } from '@/app/lib/api';

interface DataVolumeChartProps {
  data: QueryLogMetrics[];
  bucketSize: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeLabel(date: Date, bucketSize: string): string {
  if (bucketSize.includes('s')) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (bucketSize.includes('m')) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (bucketSize.includes('h')) {
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function DataVolumeChart({ data, bucketSize }: DataVolumeChartProps) {
  const chartData = data.map((metric) => ({
    time: formatTimeLabel(new Date(metric.time_bucket), bucketSize),
    fullTime: new Date(metric.time_bucket).toLocaleString(),
    readMB: metric.total_read_bytes / (1024 * 1024),
    writtenMB: metric.total_written_bytes / (1024 * 1024),
    readBytes: metric.total_read_bytes,
    writtenBytes: metric.total_written_bytes,
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Data Read/Write Volume
        {bucketSize && <span className="ml-2 text-sm font-normal text-zinc-500">(per {bucketSize})</span>}
      </h3>
      <div className="h-64">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            No data for selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fafafa' }}
                labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ''}
                formatter={(value, name) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  const bytes = numValue * 1024 * 1024;
                  return [formatBytes(bytes), name === 'readMB' ? 'Read' : 'Written'];
                }}
              />
              <Legend
                wrapperStyle={{ color: '#9ca3af' }}
                formatter={(value) => (
                  <span className="text-zinc-400">
                    {value === 'readMB' ? 'Read' : 'Written'}
                  </span>
                )}
              />
              <Bar dataKey="readMB" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="writtenMB" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
