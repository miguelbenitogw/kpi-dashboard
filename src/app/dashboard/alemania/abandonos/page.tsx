import { getGermanyDropoutStats, getGermanyDropoutRows } from '@/lib/queries/germany'
import GermanyAbandonosView from '@/components/alemania/GermanyAbandonosView'

export const metadata = { title: 'Abandonos Alemania | KPI Dashboard' }

export default async function AlemaniaAbandonosPage() {
  const [stats, rows] = await Promise.all([
    getGermanyDropoutStats(),
    getGermanyDropoutRows(),
  ])

  return (
    <div
      style={{
        padding: '20px 24px',
        background: '#f9f7f4',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#1e4b9e',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            🇩🇪
          </span>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#1c1917',
                lineHeight: 1.2,
              }}
            >
              Abandonos · Alemania
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#78716c' }}>
              Candidatos que declinaron, se retiraron o fueron transferidos del programa alemán.
            </p>
          </div>
        </div>
      </div>

      <GermanyAbandonosView stats={stats} initialRows={rows} />
    </div>
  )
}
