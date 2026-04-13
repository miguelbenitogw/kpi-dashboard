"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export default function SyncStatus() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual Supabase query to sync_log table
    // For now, simulate with a static timestamp
    const timer = setTimeout(() => {
      setLastSync(new Date().toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }));
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
      <Activity className="h-3 w-3 shrink-0" />
      {loading ? (
        <span className="animate-pulse">Sincronizando...</span>
      ) : (
        <span>Sync: {lastSync}</span>
      )}
    </div>
  );
}
