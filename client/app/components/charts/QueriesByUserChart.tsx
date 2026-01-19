'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { QueryLog } from '@/app/lib/api';

interface QueriesByUserChartProps {
  data: QueryLog[];
}

export default function QueriesByUserChart({ data }: QueriesByUserChartProps) {
  const userCounts = data.reduce(
    (acc, log) => {
      const user = log.user || 'unknown';
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const chartData = Object.entries(userCounts)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Queries by User
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
            />
            <YAxis
              type="category"
              dataKey="user"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={{ stroke: '#9ca3af' }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fafafa' }}
              itemStyle={{ color: '#a855f7' }}
            />
            <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
