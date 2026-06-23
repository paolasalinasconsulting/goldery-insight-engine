import type { ReactNode } from "react";
import { useGoldery } from "@/lib/goldery/store";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { categoria, periodo, cadena, fileName } = useGoldery();
  return (
    <div className="border-b border-border bg-card/60 backdrop-blur">
      <div className="px-8 py-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span className="chip-neutral px-2 py-0.5 rounded">{categoria}</span>
            <span>·</span><span>{periodo}</span>
            <span>·</span><span>{cadena}</span>
            <span>·</span><span className="truncate max-w-[200px]">{fileName}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, tone = "neutral" }: {
  label: string; value: ReactNode; sub?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    neutral: "text-foreground",
    good: "text-[color:var(--color-success)]",
    warn: "text-[color:var(--color-warning)]",
    bad: "text-[color:var(--color-danger)]",
  }[tone];
  return (
    <div className="kpi-card">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Chip({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  const cls = { good: "chip-good", warn: "chip-warn", bad: "chip-bad", neutral: "chip-neutral" }[tone];
  return <span className={`${cls} inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium`}>{children}</span>;
}

export function InsightCard({ title, body, tone = "neutral", icon }: {
  title: string; body: ReactNode; tone?: "good" | "warn" | "bad" | "neutral"; icon?: ReactNode;
}) {
  const border = {
    good: "border-l-[color:var(--color-success)]",
    warn: "border-l-[color:var(--color-warning)]",
    bad: "border-l-[color:var(--color-danger)]",
    neutral: "border-l-[color:var(--color-ring)]",
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
