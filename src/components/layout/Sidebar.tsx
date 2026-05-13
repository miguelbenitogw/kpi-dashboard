'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  TrendingDown,
  MessageSquare,
  Tag,
  Menu,
  X,
  Settings2,
  Briefcase,
  Globe,
  Wallet,
  Wifi,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
}

type NavSection = {
  title: string | null
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
    ],
  },
  {
    title: 'OPERACIÓN · ATRACCIÓN',
    items: [
      { href: '/dashboard/atraccion',      label: 'Atracción',     icon: Users },
      { href: '/dashboard/web-rrss',       label: 'Web y RRSS',    icon: Wifi },
      { href: '/dashboard/instituciones',  label: 'Instituciones', icon: Building2 },
    ],
  },
  {
    title: 'OPERACIÓN · NORUEGA',
    items: [
      { href: '/dashboard/formacion', label: 'Formación', icon: GraduationCap },
      { href: '/dashboard/formacion/abandonos', label: 'Abandonos', icon: TrendingDown },
      { href: '/dashboard/colocacion', label: 'Colocación', icon: Briefcase },
      { href: '/dashboard/contabilidad', label: 'Pagos', icon: Wallet },
    ],
  },
  {
    title: 'OPERACIÓN · ALEMANIA',
    items: [
      { href: '/dashboard/alemania', label: 'Alemania', icon: Globe },
      { href: '/dashboard/alemania/abandonos', label: 'Abandonos', icon: TrendingDown },
      { href: '/dashboard/alemania/pagos', label: 'Pagos', icon: Wallet },
    ],
  },
  {
    title: 'HERRAMIENTAS',
    items: [
      { href: '/dashboard/chat', label: 'Asistente IA', icon: MessageSquare, badge: 'beta' },
      { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings2 },
      { href: '/dashboard/etiquetas', label: 'Etiquetas', icon: Tag },
    ],
  },
]

const EXPANDED_W = 240
const COLLAPSED_W = 56

function SyncDot({ collapsed }: { collapsed: boolean }) {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (collapsed) {
    return (
      <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          title={`Sync · ${time}`}
          style={{
            display: 'inline-block', width: 8, height: 8,
            borderRadius: '50%', background: '#16a34a', flexShrink: 0,
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: '#78716c' }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
      <span>Sync · {time}</span>
    </div>
  )
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // Read persisted state after mount (avoids SSR mismatch)
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  if (pathname.startsWith('/auth')) return null

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile hamburger — outside sidebar */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg p-2 lg:hidden"
        style={{ background: '#ffffff', border: '1px solid #e7e2d8', color: '#1e4b9e' }}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          lg:static lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: 'width 220ms ease, transform 200ms ease',
          background: '#ffffff',
          borderRight: '1px solid #e7e2d8',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          className="flex h-16 items-center justify-between"
          style={{
            borderBottom: '1px solid #e7e2d8',
            flexShrink: 0,
            padding: collapsed ? '0 11px' : '0 12px 0 16px',
            transition: 'padding 220ms ease',
          }}
        >
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-w-0 flex-1"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Globalworking Dashboard' : undefined}
            style={{ overflow: 'hidden' }}
          >
            <span
              className="relative flex items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ width: 34, height: 34, flexShrink: 0, background: '#1e4b9e' }}
            >
              <span
                className="absolute top-0 left-0 right-0 rounded-t-lg"
                style={{ height: 3, background: '#e55a2b' }}
              />
              gw
            </span>
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 1,
                overflow: 'hidden',
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : 'auto',
                transition: 'opacity 150ms ease, width 220ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: '#1c1917' }}>Globalworking</span>
              <span className="text-[10px]" style={{ color: '#78716c' }}>Enfermería · Noruega</span>
            </span>
          </Link>

          {/* Mobile: close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 lg:hidden flex-shrink-0"
            style={{ color: '#78716c' }}
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop: collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex rounded-lg p-1.5 flex-shrink-0"
            style={{ color: '#78716c' }}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />
            }
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-3" style={{ padding: '12px 8px' }}>
          {navSections.map((section, idx) => (
            <div key={idx}>
              {/* Section title or divider */}
              {section.title && (
                collapsed
                  ? <div style={{ height: 1, margin: '4px 4px 6px', background: '#e7e2d8' }} />
                  : (
                    <p
                      className="mb-1 px-2 text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: '#1e4b9e', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    >
                      {section.title}
                    </p>
                  )
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className="flex items-center rounded-md transition-colors"
                      style={{
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '6px 0' : '6px 8px',
                        gap: collapsed ? 0 : 10,
                        borderLeft: active ? '3px solid #e55a2b' : '3px solid transparent',
                        background: active ? '#f5f1ea' : 'transparent',
                        color: active ? '#1e4b9e' : '#57534e',
                        minWidth: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#f5f1ea'
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                      }}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: active ? '#e55a2b' : '#78716c' }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: 'hidden',
                          opacity: collapsed ? 0 : 1,
                          width: collapsed ? 0 : 'auto',
                          transition: 'opacity 120ms ease',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {item.label}
                        {item.badge && (
                          <span
                            style={{
                              borderRadius: 99, padding: '2px 6px',
                              fontSize: 10, fontWeight: 600,
                              background: '#e7e2d8', color: '#57534e',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e7e2d8', flexShrink: 0 }}>
          <SyncDot collapsed={collapsed} />
        </div>
      </aside>
    </>
  )
}
