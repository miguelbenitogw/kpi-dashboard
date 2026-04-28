import FormacionLayout from '@/components/formacion/FormacionLayout'
import PromoVistaGeneral from '@/components/formacion/PromoVistaGeneral'

export default function FormacionPage() {
  return (
    <div>
      <div
        style={{
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
