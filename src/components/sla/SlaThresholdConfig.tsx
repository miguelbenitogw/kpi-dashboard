'use client';

import { useEffect, useState } from 'react';
import { getSlaThresholds, updateSlaThresholds } from '@/lib/queries/sla';
import type { SlaThresholds } from '@/lib/queries/sla';
import { Save, RotateCcw, Settings } from 'lucide-react';

export default function SlaThresholdConfig() {
  const [thresholds, setThresholds] = useState<SlaThresholds>({});
  const [original, setOriginal] = useState<SlaThresholds>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSlaThresholds();
        setThresholds(data);
        setOriginal(data);
      } catch (err) {
        console.error('Failed to load thresholds:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleChange(status: string, field: 'yellow' | 'red', value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setThresholds((prev) => ({
      ...prev,
      [status]: { ...prev[status], [field]: num },
    }));
  }

  function handleReset() {
    setThresholds(original);
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateSlaThresholds(thresholds);
      setOriginal(thresholds);
      setMessage({ type: 'success', text: 'Umbrales guardados correctamente.' });
    } catch (err) {
      console.error('Failed to save thresholds:', err);
      setMessage({ type: 'error', text: 'Error al guardar los umbrales.' });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = JSON.stringify(thresholds) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-56 rounded bg-gray-700" />
          <div className="h-48 rounded bg-gray-700/50" />
        </div>
      </div>
    );
  }

  const statuses = Object.keys(thresholds).sort();

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
          <Settings className="h-5 w-5 text-gray-400" />
          Configuracion de Umbrales SLA
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resetear
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40'
              : 'bg-red-900/30 text-red-300 border border-red-700/40'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Estado</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-yellow-400">
                Amarillo (dias)
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-red-400">
                Rojo (dias)
              </th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => (
              <tr key={status} className="border-t border-gray-700/30">
                <td className="px-3 py-2 text-gray-200">{status}</td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="number"
                    min={0}
                    value={thresholds[status]?.yellow ?? 0}
                    onChange={(e) => handleChange(status, 'yellow', e.target.value)}
                    className="w-20 rounded-md border border-yellow-800/40 bg-yellow-900/20 px-2 py-1 text-center text-sm text-yellow-200 outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600/50"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="number"
                    min={0}
                    value={thresholds[status]?.red ?? 0}
                    onChange={(e) => handleChange(status, 'red', e.target.value)}
                    className="w-20 rounded-md border border-red-800/40 bg-red-900/20 px-2 py-1 text-center text-sm text-red-200 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
