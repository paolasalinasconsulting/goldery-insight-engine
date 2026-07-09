import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Upload, Database, ListOrdered, Layers,
  DollarSign, MessageSquare, Package, FlaskConical, Target, FileDown, Settings as SettingsIcon, BarChart3, LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { pushToCloud, stopAutoSync } from "@/lib/goldery/sync";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/upload", label: "Carga de data", icon: Upload },
  { to: "/base", label: "Base normalizada", icon: Database },
  { to: "/share", label: "Share de mercado", icon: BarChart3 },
  { to: "/pareto", label: "Pareto", icon: ListOrdered },
  { to: "/segmentos", label: "Opportunity Map", icon: Layers },
  { to: "/precios", label: "Price Index", icon: DollarSign },
  { to: "/claims", label: "Claim Match", icon: MessageSquare },
  { to: "/empaque", label: "Silent Seller Score", icon: Package },
  { to: "/mercadito", label: "Market Test", icon: FlaskConical },
  { to: "/recomendacion", label: "Recomendación", icon: Target },
  { to: "/exportar", label: "Reportes", icon: FileDown },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon },
] as const;

function CategoryIQMark() {
  // Minimalist mark: gondola + ascending radar/growth line
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="9" className="fill-[color:var(--color-brand)]" />
      <path d="M9 27 L17 19 L23 23 L31 13" stroke="#06B6D4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="13" r="2.2" fill="#FFFFFF" />
      <line x1="9" y1="30.5" x2="31" y2="30.5" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <CategoryIQMark />
          <div className="leading-tight">
            <div className="font-bold text-[15px] tracking-tight text-white">Category IQ</div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-sidebar-foreground/55 mt-0.5">
              Category Intelligence
            </div>
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all relative ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--color-cyan)]" />}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <UserFooter />
    </aside>
  );
}

function UserFooter() {
  const { user } = useAuth();
  async function signOut() {
    if (user) { try { await pushToCloud(user.id); } catch {} }
    stopAutoSync();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }
  return (
    <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
      {user && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.1em] text-sidebar-foreground/45">Sesión</div>
            <div className="text-[11px] text-white/85 truncate" title={user.email ?? ""}>{user.email}</div>
          </div>
          <button
            onClick={signOut}
            title="Cerrar sesión"
            className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-white hover:bg-white/5"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-sidebar-foreground/45">Powered by</div>
        <div className="text-[12px] font-semibold text-white/85 mt-0.5">Goldery</div>
      </div>
    </div>
  );
}
