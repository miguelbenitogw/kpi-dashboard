import InstitutionesView from '@/components/atraccion/InstitutionesView'

export default function InstitucionesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.01em', margin: 0 }}>
          Instituciones
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
          BBDD de universidades y centros por programa
        </p>
      </div>

      <InstitutionesView />
    </div>
  )
}
