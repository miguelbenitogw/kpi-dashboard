'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { RecruiterStat } from '@/lib/queries/funnel';

interface RecruiterComparisonProps {
  data: RecruiterStat[];
}

function getRateColor(rate: number): string {
  if (rate >= 15) return 'text-green-400';
  if (rate >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

export default function RecruiterComparison({
  data,
}: RecruiterComparisonProps) {
  const chartData = data.slice(0, 12).map((r) => ({
    name: r.owner.length > 18 ? r.owner.slice(0, 16) + '...' : r.owner,
    fullName: r.owner,
    interviewRate: r.interviewRate,
    hiredRate: r.hiredRate,
    total: r.totalCandidates,
  }));

  return (
    <div className="w-full">
      {data.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          No recruiter data available
        </div>
      ) : (
        <>
          {/* Grouped bar chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                  formatter={((value: number, name: string) => [
                    `${value}%`,
                    name === 'interviewRate'
                      ? 'To Interview'
                      : 'To Hired',
                  ]) as any}
                  labelFormatter={(label) => {
                    const item = chartData.find((d) => d.name === label);
                    return item
                      ? `${item.fullName} (${item.total} candidates)`
                      : label;
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'interviewRate'
                      ? 'To Interview'
                      : 'To Hired'
                  }
                  wrapperStyle={{ color: '#9ca3af' }}
                />
                <Bar
                  dataKey="interviewRate"
                  fill="#60a5fa"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="hiredRate"
                  fill="#22c55e"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-400">
                    Recruiter
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    Candidates
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    To Interview
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    To Hired
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">
                    Avg Days to Hire
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.owner}
                    className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-2 font-medium text-gray-200">
                      {row.owner}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                      {row.totalCandidates.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="tabular-nums text-blue-400">
                        {row.interviewRate}%
                      </span>
                      <span className="ml-1 text-xs text-gray-500">
                        ({row.reachedInterview})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums font-semibold ${getRateColor(row.hiredRate)}`}
                      >
                        {row.hiredRate}%
                      </span>
                      <span className="ml-1 text-xs text-gray-500">
                        ({row.hired})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                      {row.avgDaysToHire !== null ? (
                        <span>
                          {row.avgDaysToHire}{' '}
                          <span className="text-gray-500">d</span>
                        </span>
                      ) : (
                        <span className="text-gray-600">--</span>
                      )}
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
