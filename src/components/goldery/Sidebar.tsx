import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Upload, Database, BarChart3, ListOrdered, Layers,
  DollarSign, MessageSquare, Package, FlaskConical, Target, FileDown, Settings as SettingsIcon,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Resumen ejecutivo", icon: LayoutDashboard },
  { to: "/upload", label: "Subir data", icon: Upload },
  { to: "/base", label: "Base normalizada", icon: Database },
  { to: "/share", label: "Share de mercado", icon: BarChart3 },
  { to: "/pareto", label: "Pareto de SKUs", icon: ListOrdered },
  { to: "/segmentos", label: "Segmentos", icon: Layers },
  { to: "/precios", label: "Precios vs líder", icon: DollarSign },
  { to: "/claims", label: "Claims", icon: MessageSquare },
  { to: "/empaque", label: "Empaque", icon: Package },
  { to: "/mercadito", label: "Mercadito", icon: FlaskConical },
  { to: "/recomendacion", label: "Recomendación", icon: Target },
  { to: "/exportar", label: "Exportar reporte", icon: FileDown },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-brand grid place-items-center text-brand-foreground font-bold">G</div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Goldery</div>
            <div className="text-[11px] text-sidebar-foreground/60">Analizador estratégico</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((n) => {
          const active = loc.pathname === n.to;
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/55">
        v1.0 · Metodología Me-Too
      </div>
    </aside>
  );
}
