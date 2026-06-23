import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments, brandRanking, paretoSkus } from "@/lib/goldery/calc";
import { PageHeader, KpiCard, InsightCard, Chip, fmtNum, fmtPct, fmtMoney } from "@/components/goldery/ui";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Target, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resumen ejecutivo · Goldery Analyzer" },
      { name: "description", content: "Vista ejecutiva del diagnóstico de categoría: share, oportunidades y ruta estratégica recomendada." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, settings, categoria, periodo } = useGoldery();

  const brands = useMemo(() => brandRanking(data), [data]);
  const segs = useMemo(() => analyzeSegments(data, settings), [data, settings]);
  const pareto = useMemo(() => paretoSkus(data), [data]);

  const totalVol = data.reduce((s, r) => s + r.volumenMl, 0);
  const totalValor = data.reduce((s, r) => s + r.ventasValor, 0);
  const totalU = data.reduce((s, r) => s + r.unidades, 0);
  const goldery = brands.find((b) => b.esGoldery);
  const segParticipa = segs.filter((s) => s.participaGoldery).length;
  const segNoParticipa = segs.length - segParticipa;
  const oport = segs[0];

  const chartData = brands.slice(0, 8).map((b) => ({ marca: b.marca, share: +(b.shareVolumen * 100).toFixed(1), esGoldery: b.esGoldery }));

  return (
    <>
      <PageHeader
        title="Resumen ejecutivo"
        subtitle={`Diagnóstico de ${categoria} · ${periodo}`}
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Volumen categoría" value={`${fmtNum(totalVol / 1000)} L`} sub={`${fmtNum((totalVol / 1_000_000) * settings.densidad, 1)} ton`} />
          <KpiCard label="Ventas valor" value={fmtMoney(totalValor)} sub={`${fmtNum(totalU)} unidades`} />
          <KpiCard
            label={`Share volumen ${settings.marcaPropia}`}
            value={fmtPct(goldery?.shareVolumen ?? 0)}
            sub={`Ranking #${goldery?.rank ?? "—"} de ${brands.length}`}
            tone={(goldery?.shareVolumen ?? 0) > 0.1 ? "good" : (goldery?.shareVolumen ?? 0) > 0.05 ? "warn" : "bad"}
          />
          <KpiCard
            label="Segmentos donde NO participa"
            value={`${segNoParticipa} / ${segs.length}`}
            sub={`${segParticipa} segmentos activos`}
            tone={segNoParticipa > segParticipa ? "bad" : "warn"}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">Share de volumen por marca</div>
                <div className="text-xs text-muted-foreground">Top 8 — barra destacada = marca propia</div>
              </div>
              <Link to="/share" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ver detalle <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="marca" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                  <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.esGoldery ? "var(--color-brand)" : "var(--color-chart-1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-sm font-semibold mb-3">Pareto de la categoría</div>
            <div className="text-xs text-muted-foreground mb-3">
              {pareto.filter((p) => p.enPareto80).length} SKUs concentran el 80% del volumen
            </div>
            <div className="space-y-2 max-h-[230px] overflow-y-auto pr-1">
              {pareto.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate">{p.descripcion}</span>
                  <Chip tone={p.esGoldery ? "good" : "neutral"}>{fmtPct(p.shareVolumen)}</Chip>
                </div>
              ))}
            </div>
          </div>
        </div>

        {oport && (
          <div className="grid lg:grid-cols-2 gap-6">
            <InsightCard
              tone={oport.nivelOportunidad === "Alta" ? "good" : oport.nivelOportunidad === "Media" ? "warn" : "neutral"}
              icon={<Target className="h-5 w-5 text-[color:var(--color-success)] mt-0.5" />}
              title={`Oportunidad principal: ${oport.segmento}`}
              body={
                <>
                  <div className="mb-2"><Chip tone={oport.nivelOportunidad === "Alta" ? "good" : "warn"}>Score {oport.scoreOportunidad}/100 · {oport.nivelOportunidad}</Chip></div>
                  {oport.diagnostico}
                </>
              }
            />
            <InsightCard
              tone={oport.recomendacion === "lanzar" ? "good" : oport.recomendacion === "ajuste" ? "warn" : "neutral"}
              icon={oport.recomendacion === "lanzar" ? <TrendingUp className="h-5 w-5 text-[color:var(--color-success)] mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning)] mt-0.5" />}
              title={`Ruta estratégica recomendada: ${rutaLabel(oport.recomendacion)}`}
              body={
                <>
                  {rutaDescripcion(oport.recomendacion)}{" "}
                  <Link to="/recomendacion" className="text-primary hover:underline">Ver recomendación completa →</Link>
                </>
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

function rutaLabel(r: "no-hacer" | "ajuste" | "lanzar") {
  return r === "lanzar" ? "Nuevo lanzamiento / rediseño" : r === "ajuste" ? "Ajuste táctico" : "No hacer nada";
}
function rutaDescripcion(r: "no-hacer" | "ajuste" | "lanzar") {
  return r === "lanzar"
    ? "El segmento pesa, hay brecha frente al líder y existe espacio para entrar con tamaño y claim correctos."
    : r === "ajuste"
    ? "Goldery ya está. El problema no parece ser precio sino comunicación, empaque o claim. Ajustar antes de invertir en producto."
    : "La oportunidad no justifica inversión. Concentrar recursos en segmentos de mayor peso.";
}
