import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { useGoldery } from "@/lib/goldery/store";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { categoria, periodo, cadena, fileName, settings } = useGoldery();
  return (
    <div className="border-b border-border bg-card">
      <div className="px-8 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
          <ContextItem label="Categoría" value={categoria} />
          <ContextItem label="Periodo" value={periodo} />
          <ContextItem label="Cadena" value={cadena} />
          <ContextItem label="Marca propia" value={settings.marcaPropia} />
          <ContextItem label="Archivo" value={fileName} />
        </div>
      </div>
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground font-medium truncate max-w-[200px]">{value}</span>
    </div>
  );
}

export function KpiCard({ label, value, sub, tone = "neutral" }: {
  label: string; value: ReactNode; sub?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const toneClass = {
    neutral: "text-foreground",
    info: "text-[color:var(--color-brand)]",
    good: "text-[color:var(--color-success)]",
    warn: "text-[color:var(--color-warning)]",
    bad: "text-[color:var(--color-danger)]",
  }[tone];
  return (
    <div className="kpi-card">
      <div className="text-[10px] uppercase tracking-[0.09em] text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums leading-none ${toneClass}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground leading-snug">{sub}</div>}
    </div>
  );
}

export function Chip({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral" | "info"; children: ReactNode }) {
  const cls = { good: "chip-good", warn: "chip-warn", bad: "chip-bad", neutral: "chip-neutral", info: "chip-info" }[tone];
  return <span className={`${cls} inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold`}>{children}</span>;
}

export function InsightCard({ title, body, tone = "neutral", icon }: {
  title: string; body: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" | "info"; icon?: ReactNode;
}) {
  const border = {
    good: "border-l-[color:var(--color-success)]",
    warn: "border-l-[color:var(--color-warning)]",
    bad: "border-l-[color:var(--color-danger)]",
    info: "border-l-[color:var(--color-cyan)]",
    neutral: "border-l-[color:var(--color-brand)]",
  }[tone];
  return (
    <div className={`panel border-l-4 ${border} p-5`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</div>
        </div>
      </div>
    </div>
  );
}

export function SoWhat({ children, title = "So What?" }: { children: ReactNode; title?: string }) {
  return (
    <div className="so-what">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg brand-gradient grid place-items-center shrink-0">
          <Lightbulb className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[color:var(--color-brand)]">
            {title}
          </div>
          <div className="text-sm text-foreground mt-1 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function fmtNum(n: number, d = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-EC", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtPct(n: number, d = 1): string {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(d) + "%";
}
export function fmtMoney(n: number): string {
  if (!isFinite(n)) return "—";
  return "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
