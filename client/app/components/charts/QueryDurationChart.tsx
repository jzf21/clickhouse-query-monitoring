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
import { QueryLogMetrics } from '@/app/lib/api';

interface QueryDurationChartProps {
  data: QueryLogMetrics[];
  bucketSize: string;
}

function formatTimeLabel(date: Date, bucketSize: string): string {
  // Format based on bucket size for appropriate granularity
  if (bucketSize.includes('s')) {
    // Seconds - show HH:MM:SS
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (bucketSize.includes('m')) {
    // Minutes - show HH:MM
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (bucketSize.includes('h')) {
    // Hours - show date + hour
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    // Days or longer - show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function QueryDurationChart({ data, bucketSize }: QueryDurationChartProps) {
  const chartData = data.map((metric) => ({
    time: formatTimeLabel(new Date(metric.time_bucket), bucketSize),
    fullTime: new Date(metric.time_bucket).toLocaleString(),
    avgDuration: Math.round(metric.avg_duration_ms * 100) / 100,
    maxDuration: metric.max_duration_ms,
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Query Duration Over Time
        {bucketSize && <span className="ml-2 text-sm font-normal text-zinc-500">(per {bucketSize})</span>}
      </h3>
      <div className="h-64">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            No data for selected time range
          </div>
        ) : (
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
                labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ''}
                formatter={(value, name) => [
                  `${(value ?? 0).toLocaleString()} ms`,
                  name === 'avgDuration' ? 'Avg Duration' : 'Max Duration',
                ]}
              />
              <Line
                type="monotone"
                dataKey="avgDuration"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="avgDuration"
              />
              <Line
                type="monotone"
                dataKey="maxDuration"
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="maxDuration"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
