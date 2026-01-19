'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { QueryLog } from '@/app/lib/api';

interface QueryDurationChartProps {
  data: QueryLog[];
}

export default function QueryDurationChart({ data }: QueryDurationChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((log) => ({
      time: new Date(log.event_time).toLocaleTimeString(),
      duration: log.query_duration_ms,
    }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Query Duration Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
              label={{
                value: 'Duration (ms)',
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
              itemStyle={{ color: '#22c55e' }}
            />
            <Line
              type="monotone"
              dataKey="duration"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
