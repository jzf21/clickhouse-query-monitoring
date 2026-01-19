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
import { QueryLog } from '@/app/lib/api';

interface DataVolumeChartProps {
  data: QueryLog[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DataVolumeChart({ data }: DataVolumeChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .slice(-20)
    .map((log, index) => ({
      index: index + 1,
      readMB: log.read_bytes / (1024 * 1024),
      writtenMB: log.written_bytes / (1024 * 1024),
      readBytes: log.read_bytes,
      writtenBytes: log.written_bytes,
    }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Data Read/Write Volume
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="index"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
              label={{
                value: 'Query #',
                position: 'insideBottom',
                offset: -5,
                fill: '#9ca3af',
              }}
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
              formatter={(value: number, name: string) => {
                const bytes = name === 'readMB' ? value * 1024 * 1024 : value * 1024 * 1024;
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
      </div>
    </div>
  );
}
