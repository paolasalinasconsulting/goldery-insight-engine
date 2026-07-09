import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { paretoSkus, paretoBrandDiagnosis, unclassifiedStats } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/pareto")({
  head: () => ({
    meta: [
      { title: "Pareto de SKUs · Goldery Analyzer" },
      { name: "description", content: "SKUs que concentran el 80% del volumen de la categoría." },
    ],
  }),
  component: ParetoPage,
});

function ParetoPage() {
  const { data, settings, rawRows, mapping } = useGoldery();
  const pareto = useMemo(() => paretoSkus(data), [data]);
  const top80 = pareto.filter((p) => p.enPareto80);
  const uncl = useMemo(() => unclassifiedStats(rawRows, mapping, data), [rawRows, mapping, data]);
  const diag = useMemo(() => paretoBrandDiagnosis(pareto, data, settings.marcaPropia), [pareto, data, settings.marcaPropia]);

  const tone: "good" | "warn" | "bad" =
    diag.caso === "ok" ? "good"
      : diag.caso === "brecha-conversion" ? "warn"
      : "bad";

  const title =
    diag.caso === "ok" ? "Presencia sólida en el Pareto"
      : diag.caso === "brecha-portafolio" ? "Brecha de portafolio"
      : diag.caso === "brecha-conversion" ? "Brecha de conversión"
      : "Sin datos de la marca propia";

  return (
    <>
      <PageHeader title="Pareto de SKUs" subtitle={`${top80.length} SKUs concentran el 80% del volumen de la categoría.`} />
      <div className="p-8 space-y-6">
        {uncl.skus > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-4">
            <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning)] shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">
                {uncl.skus} SKUs ({(uncl.pctUnidades * 100).toFixed(1)}% de las unidades) sin tamaño asignado
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                Estos SKUs no entran al ranking del Pareto porque no pueden convertirse a volumen. Ejemplos: {uncl.ejemplos.join(" · ")}.
              </div>
              <Link to="/upload" className="inline-block mt-2 text-xs text-[color:var(--color-brand)] hover:underline font-medium">
                → Completar tamaño en la carga de datos
              </Link>
            </div>
          </div>
        )}

        <InsightCard tone={tone} title={title} body={diag.mensaje} />

        {diag.caso !== "sin-goldery" && (
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <MiniStat label="SKUs propios en el Pareto 80" value={String(diag.golderyEn80)} />
            <MiniStat label="Segmentos del Pareto 80" value={diag.segmentosPareto80.join(", ") || "—"} />
            <MiniStat label={`Segmentos donde ${settings.marcaPropia} participa`} value={diag.segmentosGoldery.join(", ") || "—"} />
          </div>
        )}

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Marca</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Segmento</th>
                <th className="px-3 py-2 text-right">Unidades</th>
                <th className="px-3 py-2 text-right">Volumen (L)</th>
                <th className="px-3 py-2 text-right">Share</th>
                <th className="px-3 py-2 text-right">Acumulado</th>
                <th className="px-3 py-2 text-left">Pareto 80</th>
              </tr>
            </thead>
            <tbody>
              {pareto.slice(0, 60).map((p, i) => (
                <tr key={p.id} className={`border-t border-border ${p.esGoldery ? "bg-brand/10" : ""}`}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                    {p.marca || <span className="text-[color:var(--color-danger)]">(sin marca)</span>}
                    {p.esGoldery && <Chip tone="good">propia</Chip>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.descripcion || `${p.marca} ${fmtNum(p.tamanoMl)} ml`}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{p.segmento}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.unidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.volumenL, 1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.shareVolumen, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.acumulado)}</td>
                  <td className="px-3 py-2">{p.enPareto80 ? <Chip tone="good">en 80%</Chip> : <Chip tone="neutral">cola</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}
