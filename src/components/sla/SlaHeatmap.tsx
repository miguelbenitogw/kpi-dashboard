'use client';

import { useEffect, useState } from 'react';
import { getHeatmapData, getSlaThresholds } from '@/lib/queries/sla';
import type { HeatmapCell, SlaThresholds } from '@/lib/queries/sla';

const KEY_STAGES = [
  'Associated',
  'First Call',
  'Second Call',
  'Check Interest',
  'Interview to be Scheduled',
  'Interview-Scheduled',
  'Interview in Progress',
  'Waiting for Evaluation',
  'Approved by client',
  'Waiting for Consensus',
];

interface VacancyRow {
  vacancy_id: string;
  vacancy_title: string;
  alert_count: number;
  cells: Map<string, HeatmapCell>;
}

function getCellColor(avgDays: number, threshold: { yellow: number; red: number } | undefined): string {
  if (!threshold) return 'bg-gray-800/50';
  const ratio = avgDays / threshold.red;
  if (ratio > 1) return 'bg-red-900/60 text-red-200';
  if (ratio >= 0.5) return 'bg-yellow-900/50 text-yellow-200';
  return 'bg-emerald-900/40 text-emerald-200';
}

function getCellBorder(avgDays: number, threshold: { yellow: number; red: number } | undefined): string {
  if (!threshold) return 'border-gray-700/30';
  const ratio = avgDays / threshold.red;
  if (ratio > 1) return 'border-red-700/50';
  if (ratio >= 0.5) return 'border-yellow-700/40';
  return 'border-emerald-700/30';
}

export default function SlaHeatmap() {
  const [rows, setRows] = useState<VacancyRow[]>([]);
  const [thresholds, setThresholds] = useState<SlaThresholds>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cells, thresh] = await Promise.all([getHeatmapData(), getSlaThresholds()]);
        setThresholds(thresh);

        // Group by vacancy
        const vacMap = new Map<string, VacancyRow>();
        for (const cell of cells) {
          let row = vacMap.get(cell.vacancy_id);
          if (!row) {
            row = {
              vacancy_id: cell.vacancy_id,
              vacancy_title: cell.vacancy_title,
              alert_count: 0,
              cells: new Map(),
            };
            vacMap.set(cell.vacancy_id, row);
          }
          row.cells.set(cell.status, cell);
          row.alert_count += cell.candidate_count;
        }

        // Sort by alert count desc, take top 10
        const sorted = Array.from(vacMap.values())
          .sort((a, b) => b.alert_count - a.alert_count)
          .slice(0, 10);

        setRows(sorted);
      } catch (err) {
        console.error('Failed to load heatmap data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-gray-700" />
          <div className="h-64 rounded bg-gray-700/50" />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <p className="text-gray-500">No hay datos de heatmap disponibles.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Heatmap: Vacante x Etapa</h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-emerald-900/60" /> &lt;50%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-yellow-900/60" /> 50-100%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-red-900/60" /> &gt;100%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-800/90 px-3 py-2 text-left text-xs font-medium text-gray-400">
                Vacante
              </th>
              {KEY_STAGES.map((stage) => (
                <th
                  key={stage}
                  className="px-2 py-2 text-center text-xs font-medium text-gray-400"
                  title={stage}
                >
                  {stage.length > 12 ? stage.slice(0, 11) + '...' : stage}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.vacancy_id} className="border-t border-gray-700/30">
                <td
                  className="sticky left-0 z-10 bg-gray-800/90 px-3 py-2 text-gray-200"
                  title={row.vacancy_title}
                >
                  <span className="block max-w-[180px] truncate">{row.vacancy_title}</span>
                </td>
                {KEY_STAGES.map((stage) => {
                  const cell = row.cells.get(stage);
                  const threshold = thresholds[stage];
                  if (!cell) {
                    return (
                      <td key={stage} className="px-2 py-2 text-center">
                        <span className="text-gray-600">-</span>
                      </td>
                    );
                  }
                  return (
                    <td key={stage} className="px-1 py-1 text-center">
                      <div
                        className={`rounded px-2 py-1.5 text-xs font-medium border ${getCellColor(
                          cell.avg_days,
                          threshold
                        )} ${getCellBorder(cell.avg_days, threshold)}`}
                        title={`${cell.avg_days}d avg | ${cell.candidate_count} candidatos | Threshold: ${
                          threshold ? `${threshold.yellow}d / ${threshold.red}d` : 'N/A'
                        }`}
                      >
                        {cell.avg_days}d
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
