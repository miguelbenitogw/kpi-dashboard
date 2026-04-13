'use client'

import { useState, useEffect, useRef } from 'react'

interface RealtimeIndicatorProps {
  lastUpdate: Date | null
}

export default function RealtimeIndicator({ lastUpdate }: RealtimeIndicatorProps) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!lastUpdate) {
      setSecondsAgo(null)
      return
    }

    const tick = () => {
      const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
      setSecondsAgo(diff)
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [lastUpdate])

  const formatTime = (secs: number): string => {
    if (secs < 5) return 'ahora mismo'
    if (secs < 60) return `hace ${secs}s`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    return `hace ${hrs}h`
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      {/* Pulse dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>

      <span>
        Realtime activo
        {secondsAgo !== null && (
          <> &middot; Última actualización: {formatTime(secondsAgo)}</>
        )}
      </span>
    </div>
  )
}
