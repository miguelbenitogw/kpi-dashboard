import RRSSOverview from '@/components/atraccion/RRSSOverview'

export default function WebRRSSPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-0.01em', margin: 0 }}>
          Web y RRSS
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
          Seguidores, alcance y métricas de redes sociales
        </p>
      </div>
      <RRSSOverview />
    </div>
  )
}
