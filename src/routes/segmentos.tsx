import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";

export const Route = createFileRoute("/segmentos")({
  head: () => ({
    meta: [
      { title: "Segmentos · Goldery Analyzer" },
      { name: "description", content: "Mapa de segmentos de tamaño: peso, líder, brecha y oportunidad para la marca propia." },
    ],
  }),
  component: SegPage,
});

function SegPage() {
  const { data, settings } = useGoldery();
  const segs = useMemo(() => analyzeSegments(data, settings), [data, settings]);
  const ausentes = segs.filter((s) => !s.participaGoldery);
  const oport = segs.filter((s) => s.nivelOportunidad === "Alta");

  return (
    <>
      <PageHeader title="Mapa de segmentos" subtitle="Peso del segmento, líder, brecha y score de oportunidad." />
      <div className="p-8 space-y-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <InsightCard
            tone={ausentes.length > 2 ? "bad" : ausentes.length > 0 ? "warn" : "good"}
            title={`Segmentos sin presencia de ${settings.marcaPropia}: ${ausentes.length}`}
            body={ausentes.length > 0
              ? `Faltantes: ${ausentes.map((a) => a.segmento).join(", ")}. Evalúa si alguno concentra peso suficiente para justificar entrada.`
              : `${settings.marcaPropia} cubre todos los segmentos con presencia en la categoría.`}
          />
          <InsightCard
            tone={oport.length > 0 ? "good" : "neutral"}
            title={`Oportunidades de alta prioridad: ${oport.length}`}
            body={oport.length > 0
              ? `Top oportunidades: ${oport.slice(0, 3).map((o) => `${o.segmento} (score ${o.scoreOportunidad})`).join(" · ")}`
              : "No hay segmentos con score Alto. La estrategia debe ser ajuste táctico o defensa."}
          />
        </div>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Segmento</th>
                  <th className="px-3 py-2 text-right">Peso cat.</th>
                  <th className="px-3 py-2 text-left">Líder</th>
                  <th className="px-3 py-2 text-right">Share líder</th>
                  <th className="px-3 py-2 text-right">Share Goldery</th>
                  <th className="px-3 py-2 text-right">Gap vs líder</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-left">Oportunidad</th>
                  <th className="px-3 py-2 text-left">Recomendación</th>
                </tr>
              </thead>
              <tbody>
                {segs.map((s) => (
                  <tr key={s.segmento} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{s.segmento}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.pesoCategoria)}</td>
                    <td className="px-3 py-2">{s.lider}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.shareLider)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.participaGoldery ? fmtPct(s.shareGolderyEnSegmento) : <Chip tone="bad">ausente</Chip>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.gapVsLider)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.scoreOportunidad}</td>
                    <td className="px-3 py-2">
                      <Chip tone={s.nivelOportunidad === "Alta" ? "good" : s.nivelOportunidad === "Media" ? "warn" : "neutral"}>
                        {s.nivelOportunidad}
                      </Chip>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Chip tone={s.recomendacion === "lanzar" ? "good" : s.recomendacion === "ajuste" ? "warn" : "neutral"}>
                        {s.recomendacion === "lanzar" ? "Lanzar/rediseñar" : s.recomendacion === "ajuste" ? "Ajuste táctico" : "No hacer nada"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          {segs.map((s) => (
            <div key={s.segmento} className="panel p-4 flex gap-4 items-start">
              <div className="w-32 shrink-0">
                <div className="text-sm font-semibold">{s.segmento}</div>
                <div className="text-xs text-muted-foreground">{fmtNum(s.volumenMl / 1000)} L</div>
              </div>
              <div className="flex-1 text-sm text-muted-foreground leading-relaxed">{s.diagnostico}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
