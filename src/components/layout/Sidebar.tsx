"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  TrendingDown,
  MessageSquare,
  Tag,
  Menu,
  X,
  Archive,
  Settings2,
  Briefcase,
  Calendar,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

type NavSection = {
  title: string | null;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    ],
  },
  {
    title: "OPERACIÓN",
    items: [
      { href: "/dashboard/atraccion", label: "Atracción", icon: Users },
      { href: "/dashboard/atraccion/cerradas", label: "Vacantes cerradas", icon: Archive },
      { href: "/dashboard/formacion", label: "Formación", icon: GraduationCap },
      { href: "/dashboard/formacion/abandonos", label: "Abandonos", icon: TrendingDown },
      { href: "/dashboard/colocacion", label: "Colocación", icon: Briefcase },
      { href: "/dashboard/promos", label: "Promociones", icon: Calendar },
    ],
  },
  {
    title: "HERRAMIENTAS",
    items: [
      { href: "/dashboard/chat", label: "Asistente IA", icon: MessageSquare, badge: "beta" },
      { href: "/dashboard/configuracion", label: "Configuración", icon: Settings2 },
      { href: "/dashboard/etiquetas", label: "Etiquetas", icon: Tag },
    ],
  },
];

function SyncDot() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: "#78716c" }}>
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: "#16a34a" }}
      />
      <span>Sync · {time}</span>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}
      style={{
        width: 240,
        background: "#ffffff",
        borderRight: "1px solid #e7e2d8",
      }}
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center justify-between px-4"
        style={{ borderBottom: "1px solid #e7e2d8" }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          {/* GW badge */}
          <span
            className="relative flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ background: "#1e4b9e" }}
          >
            {/* Orange top bar decoration */}
            <span
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg"
              style={{ background: "#e55a2b" }}
            />
            gw
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold" style={{ color: "#1c1917" }}>
              Globalworking
            </span>
            <span className="text-[10px]" style={{ color: "#78716c" }}>
              Enfermería · Noruega
            </span>
          </span>
        </Link>

        {/* Mobile close */}
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 lg:hidden"
          style={{ color: "#78716c" }}
          aria-label="Cerrar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {navSections.map((section, idx) => (
          <div key={idx}>
            {section.title && (
              <p
                className="mb-1 px-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#1e4b9e" }}
              >
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      borderLeft: active ? "3px solid #e55a2b" : "3px solid transparent",
                      background: active ? "#f5f1ea" : "transparent",
                      color: active ? "#1e4b9e" : "#57534e",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "#f5f1ea";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      }
                    }}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: active ? "#e55a2b" : "#78716c" }}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "#e7e2d8", color: "#57534e" }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e7e2d8" }}>
        <SyncDot />
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg p-2 lg:hidden"
        style={{ background: "#ffffff", border: "1px solid #e7e2d8", color: "#1e4b9e" }}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <SidebarContent />
    </>
  );
}
