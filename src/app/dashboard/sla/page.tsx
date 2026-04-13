'use client';

import { useEffect, useState } from 'react';
import { getSlaAlerts } from '@/lib/queries/sla';
import type { SlaAlert } from '@/lib/supabase/types';
import { AlertCircle, AlertTriangle, Clock, Activity } from 'lucide-react';

import SlaHeatmap from '@/components/sla/SlaHeatmap';
import AlertList from '@/components/sla/AlertList';
import SlaThresholdConfig from '@/components/sla/SlaThresholdConfig';
import TimeHistoryChart from '@/components/sla/TimeHistoryChart';

export default function SlaPage() {
  const [alerts, setAlerts] = useState<SlaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSlaAlerts();
        setAlerts(data);
      } catch (err) {
        console.error('Failed to load SLA summary:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const redCount = alerts.filter((a) => a.alert_level === 'red').length;
  const yellowCount = alerts.filter((a) => a.alert_level === 'yellow').length;
  const avgDaysStuck =
    alerts.length > 0
      ? Math.round(
          (alerts.reduce((sum, a) => sum + (a.days_stuck ?? 0), 0) / alerts.length) * 10
        ) / 10
      : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">SLA & Tiempos</h1>
          <p className="mt-1 text-gray-400">
            Cumplimiento de SLA y tiempos de respuesta.
          </p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="rounded-lg border border-gray-700/50 bg-gray-800/50 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          {showConfig ? 'Ocultar Configuracion' : 'Configurar Umbrales'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Alertas Rojas"
          value={loading ? '--' : String(redCount)}
          icon={<AlertCircle className="h-5 w-5 text-red-400" />}
          accent="red"
        />
        <SummaryCard
          title="Alertas Amarillas"
          value={loading ? '--' : String(yellowCount)}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-400" />}
          accent="yellow"
        />
        <SummaryCard
          title="Dias Promedio Atascado"
          value={loading ? '--' : `${avgDaysStuck}d`}
          icon={<Clock className="h-5 w-5 text-blue-400" />}
          accent="blue"
        />
        <SummaryCard
          title="Total Alertas Activas"
          value={loading ? '--' : String(alerts.length)}
          icon={<Activity className="h-5 w-5 text-purple-400" />}
          accent="purple"
        />
      </div>

      {/* Threshold config (collapsible) */}
      {showConfig && (
        <div className="mt-6">
          <SlaThresholdConfig />
        </div>
      )}

      {/* Heatmap */}
      <div className="mt-6">
        <SlaHeatmap />
      </div>

      {/* Alert lists */}
      <div className="mt-6">
        <AlertList />
      </div>

      {/* Historical chart */}
      <div className="mt-6">
        <TimeHistoryChart />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: 'red' | 'yellow' | 'blue' | 'purple';
}) {
  const borderColors = {
    red: 'border-red-800/40',
    yellow: 'border-yellow-800/40',
    blue: 'border-blue-800/40',
    purple: 'border-purple-800/40',
  };

  return (
    <div
      className={`rounded-xl border bg-gray-800/50 p-6 ${borderColors[accent]}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-semibold text-gray-100">{value}</p>
    </div>
  );
}
