'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { QueryLog } from '@/app/lib/api';

interface QueryTypeChartProps {
  data: QueryLog[];
}

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7'];

export default function QueryTypeChart({ data }: QueryTypeChartProps) {
  const typeCounts = data.reduce(
    (acc, log) => {
      const type = log.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const chartData = Object.entries(typeCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Query Types Distribution
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fafafa' }}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af' }}
              formatter={(value) => <span className="text-zinc-400">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
