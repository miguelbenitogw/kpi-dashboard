'use client';

import { useEffect, useState, useMemo } from 'react';
import { getSlaAlerts } from '@/lib/queries/sla';
import type { SlaAlert } from '@/lib/supabase/types';
import { AlertTriangle, AlertCircle, Filter } from 'lucide-react';

type AlertFilter = 'all' | 'red' | 'yellow';
type SortField = 'days_stuck' | 'candidate_name' | 'job_opening_title' | 'current_status' | 'owner';

export default function AlertList() {
  const [alerts, setAlerts] = useState<SlaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [sortField, setSortField] = useState<SortField>('days_stuck');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSlaAlerts();
        setAlerts(data);
      } catch (err) {
        console.error('Failed to load alerts:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = alerts;
    if (filter !== 'all') {
      result = result.filter((a) => a.alert_level === filter);
    }
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [alerts, filter, sortField, sortAsc]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const redCount = alerts.filter((a) => a.alert_level === 'red').length;
  const yellowCount = alerts.filter((a) => a.alert_level === 'yellow').length;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-gray-700" />
          <div className="h-48 rounded bg-gray-700/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-100">Alertas SLA</h3>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('red')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filter === 'red'
                ? 'bg-red-900/60 text-red-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Rojo ({redCount})
            </span>
          </button>
          <button
            onClick={() => setFilter('yellow')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filter === 'yellow'
                ? 'bg-yellow-900/50 text-yellow-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Amarillo ({yellowCount})
            </span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No hay alertas activas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                {([
                  ['candidate_name', 'Candidato'],
                  ['job_opening_title', 'Vacante'],
                  ['current_status', 'Estado'],
                  ['days_stuck', 'Dias'],
                  ['owner', 'Owner'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-gray-400 hover:text-gray-200"
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {sortField === field && (
                        <span className="text-gray-500">{sortAsc ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nivel</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert) => (
                <tr
                  key={alert.id}
                  className={`border-t border-gray-700/30 ${
                    alert.alert_level === 'red'
                      ? 'bg-red-900/20'
                      : alert.alert_level === 'yellow'
                      ? 'bg-yellow-900/20'
                      : ''
                  }`}
                >
                  <td className="px-3 py-2.5 text-gray-200">{alert.candidate_name ?? '-'}</td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-gray-300" title={alert.job_opening_title ?? ''}>
                    {alert.job_opening_title ?? '-'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-300">{alert.current_status ?? '-'}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-100">
                    {alert.days_stuck ?? 0}d
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{alert.owner ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    {alert.alert_level === 'red' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300">
                        <AlertCircle className="h-3 w-3" /> Rojo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs font-medium text-yellow-300">
                        <AlertTriangle className="h-3 w-3" /> Amarillo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
