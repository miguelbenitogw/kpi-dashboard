import FormacionLayout from '@/components/formacion/FormacionLayout'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'

const promos = ['Todas', 'P116', 'P117', 'P118', 'P119', 'P120']

export default function FormacionPage() {
  return (
    <div>
      {/* Filter row with inline label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#78716c', marginRight: 2 }}>
          Formación
        </span>
        {promos.map((promo) => {
          const isActive = promo === 'Todas'
          return (
            <span
              key={promo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                border: isActive ? 'none' : '1px solid #e7e2d8',
                background: isActive ? '#1e4b9e' : '#ffffff',
                color: isActive ? '#ffffff' : '#78716c',
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
          marginTop: '0',
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
          marginTop: '16px',
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
