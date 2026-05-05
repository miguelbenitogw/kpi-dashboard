import {
  getGermanyKpis,
  getGermanyExamsOverview,
  getGermanyCandidates,
  getGermanyFilterOptions,
  getGermanyPaymentsSummary,
} from '@/lib/queries/germany'
import GermanyKpiStrip from '@/components/alemania/GermanyKpiStrip'
import GermanyExamsDashboard from '@/components/alemania/GermanyExamsDashboard'
import GermanyPaymentsSummary from '@/components/alemania/GermanyPaymentsSummary'

const SECTION_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e7e2d8',
  borderRadius: '14px',
  padding: '20px 24px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#1c1917',
}

const SECTION_SUB_STYLE: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '12px',
  color: '#78716c',
}

export default async function AlemaniaPage() {
  const [kpis, exams, candidatesResult, filterOptions, payments] =
    await Promise.all([
      getGermanyKpis(),
      getGermanyExamsOverview(),
      getGermanyCandidates({ page: 1, pageSize: 50 }),
      getGermanyFilterOptions(),
      getGermanyPaymentsSummary(),
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
          {/* Flag badge */}
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
              Dashboard · Alemania
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#78716c' }}>
              Candidatos, exámenes y colocaciones del programa alemán
            </p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <section>
        <GermanyKpiStrip kpis={kpis} />
      </section>

      {/* Promos + Candidatos coordinados */}
      <GermanyExamsDashboard
        exams={exams}
        initialCandidates={candidatesResult}
        filterOptions={filterOptions}
      />

      {/* Pagos */}
      <section style={SECTION_STYLE}>
        <h2 style={SECTION_TITLE_STYLE}>Pagos</h2>
        <p style={SECTION_SUB_STYLE}>
          Facturación e importes pendientes por candidato.
        </p>
        <GermanyPaymentsSummary summary={payments} />
      </section>
    </div>
  )
}
