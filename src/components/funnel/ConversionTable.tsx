'use client';

import type { ConversionRow } from '@/lib/queries/funnel';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ConversionTableProps {
  data: ConversionRow[];
}

function getRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-400';
  if (rate >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getRateBg(rate: number): string {
  if (rate >= 70) return 'bg-green-500/10';
  if (rate >= 40) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

export default function ConversionTable({ data }: ConversionTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="px-4 py-3 text-left font-medium text-gray-400">
              Stage Transition
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-400">
              Candidates In
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-400">
              Candidates Out
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-400">
              Conversion Rate
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-400">
              Avg Days
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 text-gray-200">
                  <span>{row.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                  <span>{row.to}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                {row.candidatesIn.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                {row.candidatesOut.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRateColor(row.conversionRate)} ${getRateBg(row.conversionRate)}`}
                >
                  {row.conversionRate}%
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                {row.avgDays !== null ? (
                  <span>
                    {row.avgDays} <span className="text-gray-500">days</span>
                  </span>
                ) : (
                  <span className="text-gray-600">--</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {/* Summary row */}
        {data.length > 0 && (
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="px-4 py-3 font-medium text-gray-200">
                Overall (Start to End)
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-200">
                {data[0].candidatesIn.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-200">
                {data[data.length - 1].candidatesOut.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                {(() => {
                  const overall =
                    data[0].candidatesIn > 0
                      ? Math.round(
                          (data[data.length - 1].candidatesOut /
                            data[0].candidatesIn) *
                            100
                        )
                      : 0;
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getRateColor(overall)} ${getRateBg(overall)}`}
                    >
                      {overall}%
                    </span>
                  );
                })()}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                {(() => {
                  const validDays = data.filter((d) => d.avgDays !== null);
                  if (validDays.length === 0) return '--';
                  const total = validDays.reduce(
                    (s, d) => s + (d.avgDays ?? 0),
                    0
                  );
                  return (
                    <span>
                      {total}{' '}
                      <span className="text-gray-500">days total</span>
                    </span>
                  );
                })()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {data.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          No conversion data available
        </div>
      )}
    </div>
  );
}
