import GPColocacionView from '@/components/colocacion/GPColocacionView'
import BillingPlaceholder from '@/components/colocacion/BillingPlaceholder'
import CostsPlaceholder from '@/components/colocacion/CostsPlaceholder'

const clientes = [
  { nombre: 'Bergen Kommune',         total: 18, llenadas: 14, pendientes: 4,  estado: 'Activa'  },
  { nombre: 'Stavanger Kommune',      total: 16, llenadas: 16, pendientes: 0,  estado: 'Cerrada' },
  { nombre: 'Oslo Sykehjem',          total: 22, llenadas: 18, pendientes: 4,  estado: 'Activa'  },
  { nombre: 'Trondheim Eldreomsorg',  total: 16, llenadas: 16, pendientes: 0,  estado: 'Cerrada' },
  { nombre: 'Tromsø Helse',           total: 20, llenadas: 0,  pendientes: 20, estado: 'Próxima' },
]

const estadoBadge: Record<string, { bg: string; color: string }> = {
  Activa:  { bg: '#dcfce7', color: '#166534' },
  Cerrada: { bg: '#e5e7eb', color: '#374151' },
  Próxima: { bg: '#fef3c7', color: '#854d0e' },
}

export default function ColocacionPage() {
  return (
    <div>
      {/* Heading warm */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: '#1c1917' }}
        >
          Colocación
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#78716c' }}>
          Conversión final y placement en clientes noruegos
        </p>
      </div>

      {/* Tabla de ofertas por cliente */}
      <div
        className="mt-8"
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h2
          className="mb-4 text-sm font-semibold uppercase tracking-wider"
          style={{ color: '#78716c' }}
        >
          Ofertas por cliente
        </h2>

        <div className="space-y-2">
          {clientes.map((c) => {
            const pct = c.total > 0 ? Math.round((c.llenadas / c.total) * 100) : 0
            const badge = estadoBadge[c.estado]
            return (
              <div
                key={c.nombre}
                className="grid items-center gap-4"
                style={{
                  gridTemplateColumns: '1fr 180px 80px 90px',
                  background: '#f5f1ea',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {/* Cliente */}
                <span
                  className="text-sm font-medium"
                  style={{ color: '#1c1917' }}
                >
                  {c.nombre}
                </span>

                {/* Barra de progreso */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 overflow-hidden"
                    style={{
                      height: 6,
                      background: '#ffffff',
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: '#e55a2b',
                        borderRadius: 99,
                      }}
                    />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: '#78716c' }}>
                    {c.llenadas}/{c.total}
                  </span>
                </div>

                {/* Pendientes */}
                <span
                  className="text-center text-sm tabular-nums"
                  style={{ color: c.pendientes > 0 ? '#dc2626' : '#78716c' }}
                >
                  {c.pendientes} pend.
                </span>

                {/* Badge estado */}
                <span
                  className="inline-flex justify-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {c.estado}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* GP Status + Open To — envuelto en card blanca */}
      <div
        className="mt-6"
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <GPColocacionView />
      </div>

      {/* Placeholders en grid 2 cols, cards blancas */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 18,
          }}
        >
          <BillingPlaceholder />
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 18,
          }}
        >
          <CostsPlaceholder />
        </div>
      </div>
    </div>
  )
}
