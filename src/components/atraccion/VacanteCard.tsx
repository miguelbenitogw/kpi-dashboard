'use client'

export interface FunnelStage {
  key: string
  label: string
  count: number
  color: string
}

export interface VacanteCardProps {
  id: string
  cliente: string
  rol: string
  modalidad?: string
  diasAbierta?: number
  deadline?: string
  contratados?: number
  objetivo?: number
  prioridad?: 'alta' | 'media' | 'baja'
  region?: string
  funnel?: FunnelStage[]
  onClick?: () => void
}

export const DEFAULT_FUNNEL_COLORS: Record<string, string> = {
  cv:         '#3b82f6',
  entrevista: '#8b5cf6',
  aceptado:   '#f59e0b',
  formacion:  '#10b981',
  hired:      '#16a34a',
}

export const MOCK_VACANTES: VacanteCardProps[] = [
  {
    id: 'VA-001',
    cliente: 'Bergen Kommune',
    rol: 'Enfermera UCI',
    modalidad: 'Presencial',
    diasAbierta: 45,
    deadline: '30 jun',
    contratados: 22,
    objetivo: 30,
    prioridad: 'alta',
    region: 'Bergen',
    funnel: [
      { key: 'cv',          label: 'CV',          count: 87, color: '#3b82f6' },
      { key: 'entrevista',  label: 'Entrevista',  count: 43, color: '#8b5cf6' },
      { key: 'aceptado',    label: 'Aceptado',    count: 28, color: '#f59e0b' },
      { key: 'hired',       label: 'Hired',       count: 22, color: '#16a34a' },
    ],
  },
  {
    id: 'VA-002',
    cliente: 'Oslo Sykehjem',
    rol: 'Aux. Enfermería',
    modalidad: 'Presencial',
    diasAbierta: 32,
    deadline: '15 jul',
    contratados: 8,
    objetivo: 22,
    prioridad: 'media',
    region: 'Oslo',
    funnel: [
      { key: 'cv',          label: 'CV',          count: 52, color: '#3b82f6' },
      { key: 'entrevista',  label: 'Entrevista',  count: 24, color: '#8b5cf6' },
      { key: 'aceptado',    label: 'Aceptado',    count: 12, color: '#f59e0b' },
      { key: 'hired',       label: 'Hired',       count: 8,  color: '#16a34a' },
    ],
  },
  {
    id: 'VA-003',
    cliente: 'Stavanger Kommune',
    rol: 'Enfermera Geriatría',
    modalidad: 'Híbrido',
    diasAbierta: 60,
    deadline: '1 ago',
    contratados: 16,
    objetivo: 16,
    prioridad: 'baja',
    region: 'Stavanger',
    funnel: [
      { key: 'cv',          label: 'CV',          count: 38, color: '#3b82f6' },
      { key: 'entrevista',  label: 'Entrevista',  count: 22, color: '#8b5cf6' },
      { key: 'aceptado',    label: 'Aceptado',    count: 18, color: '#f59e0b' },
      { key: 'hired',       label: 'Hired',       count: 16, color: '#16a34a' },
    ],
  },
]

const PRIORIDAD_PILL: Record<
  NonNullable<VacanteCardProps['prioridad']>,
  { label: string; color: string; bg: string }
> = {
  alta:  { label: 'Alta prioridad',  color: '#dc2626', bg: '#fef2f2' },
  media: { label: 'Media prioridad', color: '#ca8a04', bg: '#fefce8' },
  baja:  { label: 'Baja prioridad',  color: '#16a34a', bg: '#f0fdf4' },
}

function getFillColor(pct: number): string {
  if (pct >= 80) return '#16a34a'
  if (pct >= 40) return '#ca8a04'
  return '#dc2626'
}

export default function VacanteCard({
  id,
  cliente,
  rol,
  modalidad,
  diasAbierta,
  deadline,
  contratados = 0,
  objetivo = 0,
  prioridad,
  region,
  funnel = [],
  onClick,
}: VacanteCardProps) {
  const fillRate = objetivo > 0 ? Math.round((contratados / objetivo) * 100) : 0
  const fillColor = getFillColor(fillRate)
  const pill = prioridad ? PRIORIDAD_PILL[prioridad] : null
  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((s) => s.count)) : 1

  const metaItems = [modalidad, diasAbierta !== undefined ? `${diasAbierta}d` : undefined, deadline ? `deadline ${deadline}` : undefined].filter(Boolean)

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14,
        border: '1px solid #e7e2d8',
        background: '#ffffff',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 4px 12px rgba(30,75,158,0.06)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        if (!onClick) return
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = ''
        el.style.transform = ''
      }}
    >
      {/* ── Header ── */}
      <div style={{ padding: '14px 16px' }}>
        {/* Row 1: ID + prioridad pill + región */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#e55a2b',
              background: '#fdece4',
              padding: '2px 7px',
              borderRadius: 6,
            }}
          >
            #{id}
          </span>

          {pill && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: pill.color,
                background: pill.bg,
                padding: '2px 7px',
                borderRadius: 99,
              }}
            >
              ● {pill.label}
            </span>
          )}

          {region && (
            <span style={{ fontSize: 11.5, color: '#a8a29e', marginLeft: 'auto' }}>
              {region}
            </span>
          )}
        </div>

        {/* Row 2: Rol */}
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: '#1c1917',
            marginBottom: 8,
          }}
        >
          {rol}
        </div>

        {/* Row 3: meta + hired count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#78716c' }}>
            {metaItems.join(' · ')}
          </span>

          {/* Hired count + barra */}
          {objetivo > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: fillColor, lineHeight: 1 }}>
                {contratados}{' '}
                <span style={{ fontWeight: 400, color: '#a8a29e', fontSize: 12 }}>
                  /{objetivo}
                </span>
              </span>
              {/* Fill rate bar */}
              <div
                style={{
                  width: 72,
                  height: 5,
                  borderRadius: 99,
                  background: '#f5f1ea',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(fillRate, 100)}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: fillColor,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Separador ── */}
      {funnel.length > 0 && (
        <div style={{ borderTop: '1px solid #e7e2d8' }} />
      )}

      {/* ── Mini-funnel ── */}
      {funnel.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: `repeat(${funnel.length}, 1fr)`,
            gap: 8,
          }}
        >
          {funnel.map((stage) => {
            const pct = maxFunnel > 0 ? Math.round((stage.count / maxFunnel) * 100) : 0
            return (
              <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#78716c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {stage.label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', lineHeight: 1 }}>
                  {stage.count}
                </span>
                <div
                  style={{
                    height: 6,
                    borderRadius: 99,
                    background: '#f5f1ea',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: stage.color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
