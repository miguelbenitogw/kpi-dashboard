'use client'

import { useState } from 'react'
import StudentStatusList from './StudentStatusList'
import DropoutAnalysis from './DropoutAnalysis'
import ConversionFunnel from './ConversionFunnel'
import HistoryView from './HistoryView'

interface PerformanceDetailProps {
  promocion: string
}

type TabKey = 'estudiantes' | 'bajas' | 'conversion' | 'historial'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'estudiantes', label: 'Estudiantes' },
  { key: 'bajas', label: 'Bajas' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'historial', label: 'Historial' },
]

export default function PerformanceDetail({ promocion }: PerformanceDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('estudiantes')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-100">{promocion}</h2>
        <p className="text-sm text-gray-500">Detalle de rendimiento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800/80 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'estudiantes' && (
          <StudentStatusList promocion={promocion} />
        )}
        {activeTab === 'bajas' && (
          <DropoutAnalysis promocion={promocion} />
        )}
        {activeTab === 'conversion' && (
          <ConversionFunnel promocion={promocion} />
        )}
        {activeTab === 'historial' && (
          <HistoryView promocion={promocion} />
        )}
      </div>
    </div>
  )
}
