import FormacionLayout from '@/components/formacion/FormacionLayout'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'

const promos = ['Todas', 'P116', 'P117', 'P118', 'P119', 'P120']

export default function FormacionPage() {
  return (
    <div>
      {/* Encabezado warm */}
      <div>
        <h1
          style={{ color: '#1c1917', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.25 }}
        >
          Formación
        </h1>
        <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#78716c' }}>
          Seguimiento de candidatos, promociones y abandonos
        </p>
      </div>

      {/* Chips de promo decorativos */}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: '#78716c', fontWeight: 500 }}>
          Filtrar:
        </span>
        {promos.map((promo) => {
          const isActive = promo === 'Todas'
          return (
            <span
              key={promo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 12px',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 400,
                border: isActive ? '1px solid #7c3aed' : '1px solid #e7e2d8',
                background: isActive ? '#f3eaff' : '#ffffff',
                color: isActive ? '#5b21b6' : '#78716c',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              {promo}
            </span>
          )
        })}
      </div>

      {/* Card warm — Gráficos (FormacionLayout) */}
      <div
        style={{
          marginTop: '24px',
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: '14px',
          padding: '18px',
        }}
      >
        <FormacionLayout />
      </div>

      {/* Card warm — Vista General por Promoción */}
      <div
        style={{
          marginTop: '24px',
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: '14px',
          padding: '18px',
        }}
      >
        <h2
          style={{
            marginBottom: '16px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1c1917',
          }}
        >
          Vista General por Promoción
        </h2>
        <PromoVistaGeneral />
      </div>
    </div>
  )
}
