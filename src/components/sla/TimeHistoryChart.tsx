'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTimeHistory } from '@/lib/queries/sla';
import type { TimeHistoryPoint } from '@/lib/queries/sla';

const STAGE_COLORS: Record<string, string> = {
  'Associated': '#6366f1',
  'First Call': '#8b5cf6',
  'Second Call': '#a78bfa',
  'Check Interest': '#06b6d4',
  'Interview to be Scheduled': '#14b8a6',
  'Interview-Scheduled': '#10b981',
  'Interview in Progress': '#22c55e',
  'Waiting for Evaluation': '#f59e0b',
  'Approved by client': '#f97316',
  'Waiting for Consensus': '#ef4444',
  'On Hold': '#78716c',
  'No Answer': '#ec4899',
  'No Show': '#f43f5e',
  'Next Project': '#64748b',
};

function getColor(stage: string): string {
  return STAGE_COLORS[stage] ?? '#94a3b8';
}

export default function TimeHistoryChart() {
  const [data, setData] = useState<TimeHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const points = await getTimeHistory(4);
        setData(points);
      } catch (err) {
        console.error('Failed to load time history:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Transform data: pivot so each week is a row with stage keys
  const { chartData, stages } = useMemo(() => {
    const weekMap = new Map<string, Record<string, number | string>>();
    const stageSet = new Set<string>();

    for (const point of data) {
      stageSet.add(point.status);
      let row = weekMap.get(point.week_start);
      if (!row) {
        row = { week: point.week_label };
        weekMap.set(point.week_start, row);
      }
      row[point.status] = point.avg_days;
    }

    const sorted = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row);

    return { chartData: sorted, stages: Array.from(stageSet).sort() };
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-64 rounded bg-gray-700" />
          <div className="h-64 rounded bg-gray-700/50" />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-100">Historial de Tiempos por Etapa</h3>
        <p className="text-gray-500">No hay datos historicos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-100">
        Tiempo Promedio por Etapa (Ultimas 4 Semanas)
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="week"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{
                value: 'Dias promedio',
                angle: -90,
                position: 'insideLeft',
                fill: '#9ca3af',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={((value: number) => [`${value}d`, undefined]) as any}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
            />
            {stages.map((stage) => (
              <Line
                key={stage}
                type="monotone"
                dataKey={stage}
                stroke={getColor(stage)}
                strokeWidth={2}
                dot={{ r: 3, fill: getColor(stage) }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
