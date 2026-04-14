'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DailyMetrics } from '@/lib/google-analytics/client';

interface SessionsTimeChartProps {
  data: DailyMetrics[];
  loading: boolean;
}

function formatDateLabel(date: string): string {
  // "2024-01-15" → "15 Ene"
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function SessionsTimeChart({
  data,
  loading,
}: SessionsTimeChartProps) {
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
        <p className="text-gray-500">Sin datos de sesiones disponibles</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDateLabel(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#4B5563' }}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#4B5563' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#F3F4F6',
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="sessions"
          name="Sesiones"
          stroke="#60A5FA"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="users"
          name="Usuarios"
          stroke="#34D399"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="pageviews"
          name="Pageviews"
          stroke="#A78BFA"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
