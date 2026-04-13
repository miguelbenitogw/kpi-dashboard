'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type { FunnelStageData } from '@/lib/queries/funnel';

const COLORS = [
  '#60a5fa', // blue-400
  '#38bdf8', // sky-400
  '#2dd4bf', // teal-400
  '#34d399', // emerald-400
  '#4ade80', // green-400
  '#22c55e', // green-500
];

interface FunnelChartProps {
  data: FunnelStageData[];
  title?: string;
}

export default function FunnelChart({ data, title }: FunnelChartProps) {
  const chartData = useMemo(
    () =>
      data.map((stage, i) => ({
        name: stage.label,
        count: stage.count,
        percentage: stage.percentage,
        conversion: stage.conversionFromPrevious,
        fill: COLORS[i % COLORS.length],
      })),
    [data]
  );

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="w-full">
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-gray-100">{title}</h3>
      )}

      {/* Visual funnel using layered bars */}
      <div className="space-y-1">
        {data.map((stage, i) => {
          const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const minWidth = 8; // minimum visual width %
          const barWidth = Math.max(widthPct, stage.count > 0 ? minWidth : 2);

          return (
            <div key={stage.key} className="group">
              {/* Conversion arrow between stages */}
              {stage.conversionFromPrevious !== null && (
                <div className="flex items-center justify-center py-0.5">
                  <span className="text-xs font-medium text-gray-400">
                    {stage.conversionFromPrevious}% &darr;
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Label */}
                <div className="w-28 shrink-0 text-right">
                  <span className="text-sm font-medium text-gray-300">
                    {stage.label}
                  </span>
                </div>

                {/* Bar */}
                <div className="relative flex-1">
                  <div className="flex justify-center">
                    <div
                      className="relative h-10 rounded-md transition-all duration-500 group-hover:brightness-110"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                        opacity: 0.85,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-white drop-shadow-md">
                          {stage.count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Percentage */}
                <div className="w-14 shrink-0">
                  <span className="text-sm font-medium text-gray-400">
                    {stage.percentage}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recharts bar chart below for a secondary view */}
      <div className="mt-8 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
              }}
              formatter={((value: number, name: string) => [
                value.toLocaleString(),
                'Candidates',
              ]) as any}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} opacity={0.85} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                fill="#d1d5db"
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
