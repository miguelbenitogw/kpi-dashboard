"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  GitBranch,
  Filter,
  GraduationCap,
  TrendingUp,
  Briefcase,
  UserCheck,
  Clock,
  Wallet,
  MessageSquare,
  Tag,
  Menu,
  X,
} from "lucide-react";
import SyncStatus from "./SyncStatus";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavSection = {
  title: string | null;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Resumen", icon: LayoutDashboard }],
  },
  {
    title: "Atracción",
    items: [
      { href: "/dashboard/atraccion", label: "Reclutamiento", icon: Users },
      { href: "/dashboard/analytics", label: "Web & RRSS", icon: Megaphone },
      { href: "/dashboard/funnel", label: "Funnel", icon: Filter },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: GitBranch },
    ],
  },
  {
    title: "Formación",
    items: [
      { href: "/dashboard/formacion", label: "Gráficos", icon: GraduationCap },
      { href: "/dashboard/rendimiento", label: "Rendimiento", icon: TrendingUp },
      { href: "/dashboard/formacion/candidatos", label: "Candidatos", icon: UserCheck },
    ],
  },
  {
    title: "Colocación",
    items: [
      { href: "/dashboard/colocacion", label: "Placement", icon: Briefcase },
      { href: "/dashboard/candidates", label: "Candidatos", icon: UserCheck },
      { href: "/dashboard/sla", label: "SLA", icon: Clock },
    ],
  },
  {
    title: "Costes / Margen",
    items: [
      { href: "/dashboard/costes", label: "Costes", icon: Wallet },
    ],
  },
  {
    title: null,
    items: [
      { href: "/dashboard/chat", label: "Asistente IA", icon: MessageSquare },
      { href: "/dashboard/etiquetas", label: "Etiquetas", icon: Tag },
    ],
  },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-surface-800 p-2 text-gray-200 hover:bg-brand-700 hover:text-white lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-900 border-r border-surface-800
          transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header — GW wordmark */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-surface-800">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="relative flex items-center">
              {/* Orange swoosh evokes the logo arc */}
              <span className="absolute -top-1.5 left-0 h-1 w-10 rounded-full bg-accent-500 transition-transform group-hover:translate-x-1" />
              <span className="text-base font-bold tracking-tight text-brand-400">
                Global
              </span>
              <span className="text-base font-bold tracking-tight text-brand-300">
                working
              </span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-gray-400 hover:bg-surface-800 hover:text-white lg:hidden"
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section, idx) => (
            <div key={idx}>
              {section.title && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-brand-400/80">
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
                      className={`
                        flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                        transition-colors duration-150 border-l-2
                        ${
                          active
                            ? "border-accent-500 bg-brand-600/20 text-white"
                            : "border-transparent text-gray-400 hover:bg-surface-800 hover:text-gray-100"
                        }
                      `}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-accent-400" : ""
                        }`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-800">
          <SyncStatus />
        </div>
      </aside>
    </>
  );
}
