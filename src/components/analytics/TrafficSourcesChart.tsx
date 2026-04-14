'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { TrafficSource } from '@/lib/google-analytics/client';

interface TrafficSourcesChartProps {
  data: TrafficSource[];
  loading: boolean;
}

const COLORS = [
  '#60A5FA', // blue
  '#34D399', // green
  '#FBBF24', // amber
  '#F87171', // red
  '#A78BFA', // purple
  '#FB923C', // orange
  '#2DD4BF', // teal
  '#E879F9', // pink
];

/**
 * Groups sources by medium for a cleaner donut chart.
 */
function groupByMedium(sources: TrafficSource[]) {
  const grouped = new Map<string, number>();

  for (const src of sources) {
    const key = src.medium === '(none)' ? 'Direct' : capitalize(src.medium);
    grouped.set(key, (grouped.get(key) ?? 0) + src.sessions);
  }

  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function TrafficSourcesChart({
  data,
  loading,
}: TrafficSourcesChartProps) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center">
        <p className="text-gray-500">Sin datos de trafico disponibles</p>
      </div>
    );
  }

  const chartData = groupByMedium(data);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={(({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          ) as any}
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#F3F4F6',
          }}
          formatter={((value: number) => [value.toLocaleString(), 'Sesiones']) as any}
        />
        <Legend
          wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
