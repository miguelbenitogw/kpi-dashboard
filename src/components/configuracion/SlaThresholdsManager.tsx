'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Save } from 'lucide-react'
import { getSlaThresholds, updateSlaThresholds } from '@/lib/queries/sla'
import type { SlaThresholds } from '@/lib/queries/sla'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SlaThresholdsManager() {
  const [thresholds, setThresholds] = useState<SlaThresholds>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSlaThresholds()
      setThresholds(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los umbrales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -------------------------------------------------------------------------
  // Field update
  // -------------------------------------------------------------------------
  const handleChange = (
    status: string,
    field: 'yellow' | 'red',
    value: string,
  ) => {
    const num = parseInt(value, 10)
    setThresholds((prev) => ({
      ...prev,
      [status]: {
        ...prev[status],
        [field]: isNaN(num) ? 0 : num,
      },
    }))
  }

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      await updateSlaThresholds(thresholds)
      setSaveResult({ success: true, message: 'Umbrales guardados correctamente.' })
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error al guardar los umbrales',
      })
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Cargando umbrales...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    )
  }

  const statuses = Object.keys(thresholds)

  return (
    <div className="space-y-6">
      {statuses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700/50 bg-gray-800/30 p-6 text-center">
          <p className="text-sm text-gray-400">
            No hay umbrales SLA configurados todavía. Completá la tabla a continuación y guardá.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 bg-gray-800/70">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-yellow-400">
                  Amarillo (días)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-red-400">
                  Rojo (días)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {statuses.map((status) => (
                <tr key={status} className="bg-gray-900/40 hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{status}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={thresholds[status]?.yellow ?? 0}
                      onChange={(e) => handleChange(status, 'yellow', e.target.value)}
                      className="mx-auto block w-24 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-center text-sm text-yellow-300 outline-none transition-colors focus:border-yellow-500/70 focus:ring-1 focus:ring-yellow-500/30"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={thresholds[status]?.red ?? 0}
                      onChange={(e) => handleChange(status, 'red', e.target.value)}
                      className="mx-auto block w-24 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-center text-sm text-red-300 outline-none transition-colors focus:border-red-500/70 focus:ring-1 focus:ring-red-500/30"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saveResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            saveResult.success
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {saveResult.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {saveResult.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || statuses.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
