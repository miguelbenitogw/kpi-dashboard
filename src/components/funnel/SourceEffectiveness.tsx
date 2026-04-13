'use client';

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
import type { SourceStat } from '@/lib/queries/funnel';

interface SourceEffectivenessProps {
  data: SourceStat[];
}

function getBarColor(rate: number): string {
  if (rate >= 20) return '#22c55e'; // green-500
  if (rate >= 10) return '#4ade80'; // green-400
  if (rate >= 5) return '#facc15'; // yellow-400
  return '#f87171'; // red-400
}

export default function SourceEffectiveness({
  data,
}: SourceEffectivenessProps) {
  // Only show sources with at least 1 candidate, top 15
  const chartData = data
    .filter((s) => s.total > 0)
    .slice(0, 15)
    .map((s) => ({
      ...s,
      label: `${s.source} (${s.total})`,
    }));

  return (
    <div className="w-full">
      {chartData.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          No source data available
        </div>
      ) : (
        <>
          {/* Horizontal bar chart */}
          <div
            style={{ height: Math.max(chartData.length * 40 + 40, 200) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fill: '#d1d5db', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                  formatter={((value: number) => [`${value}%`, 'Hire Rate']) as any}
                  labelFormatter={(label) => {
                    const item = chartData.find((d) => d.source === label);
                    return item
                      ? `${label} - ${item.total} candidates, ${item.hired} hired`
                      : label;
                  }}
                />
                <Bar dataKey="conversionRate" radius={[0, 6, 6, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getBarColor(entry.conversionRate)}
                      opacity={0.8}
                    />
                  ))}
                  <LabelList
                    dataKey="conversionRate"
                    position="right"
                    fill="#d1d5db"
                    fontSize={12}
                    fontWeight={600}
                    formatter={((v: number) => `${v}%`) as any}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table below */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-400">
                    Source
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    Hired
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr
                    key={row.source}
                    className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-2 text-gray-200">{row.source}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                      {row.hired.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: getBarColor(row.conversionRate) }}
                      >
                        {row.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
