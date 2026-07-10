import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments, brandRanking, paretoSkus, categorySummary, normalizeRows, categoryLeader } from "@/lib/goldery/calc";
import { PageHeader, KpiCard, InsightCard, Chip, SoWhat, fmtNum, fmtPct, fmtMoney } from "@/components/goldery/ui";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Target, TrendingUp, AlertTriangle, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Category IQ by Goldery" },
      { name: "description", content: "Centro de comando ejecutivo: share, oportunidad, precio, brecha y ruta estratégica." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, settings, categoria, periodo, categorias, categoriasGuardadas, claims, cambiarCategoria } = useGoldery();

  // ------- Feature 4: resumen por categoría -------
  const categoryCards = useMemo(() => {
    return categorias.map((cat) => {
      if (cat === categoria) {
        return { cat, summary: categorySummary(data, settings, claims), activa: true };
      }
      const st = categoriasGuardadas[cat];
      if (!st) return { cat, summary: categorySummary([], settings, []), activa: false };
      const localSettings: typeof settings = { ...settings, liderManual: st.liderManual, comparacionesPrecio: st.comparacionesPrecio };
      const norm = normalizeRows(st.rawRows, st.mapping, localSettings, cat);
      return { cat, summary: categorySummary(norm, localSettings, st.claims), activa: false };
    });
  }, [categorias, categoriasGuardadas, categoria, data, settings, claims]);

  const brands = useMemo(() => brandRanking(data), [data]);
  const segs = useMemo(() => analyzeSegments(data, settings), [data, settings]);
  const pareto = useMemo(() => paretoSkus(data), [data]);

  const totalVol = data.reduce((s, r) => s + r.volumenMl, 0);
  const totalValor = data.reduce((s, r) => s + r.ventasValor, 0);
  const totalU = data.reduce((s, r) => s + r.unidades, 0);
  const goldery = brands.find((b) => b.esGoldery);
  const lider = brands[0];
  const gapShare = lider && goldery ? lider.shareVolumen - goldery.shareVolumen : 0;
  const precioMl = (b?: { ventasValor: number; volumenMl: number }) =>
    b && b.volumenMl > 0 ? b.ventasValor / b.volumenMl : 0;
  const idxPrecio = lider && goldery && precioMl(lider) > 0
    ? (precioMl(goldery) / precioMl(lider)) * 100
    : 0;
  const segParticipa = segs.filter((s) => s.participaGoldery).length;
  const segNoParticipa = segs.length - segParticipa;
  const oport = segs[0];

  const chartData = brands.slice(0, 8).map((b) => ({ marca: b.marca, share: +(b.shareVolumen * 100).toFixed(1), esGoldery: b.esGoldery }));

  return (
    <>
      <PageHeader
        title="Category IQ"
        subtitle={`Convierte data de autoservicio en decisiones de portafolio, precio, empaque y oportunidad — ${categoria} · ${periodo}`}
      />
      <div className="p-8 space-y-6">
        {/* Feature 4 · Dashboard integrado por categoría */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4 text-[color:var(--color-brand)]" />
            <div className="text-sm font-semibold">Vista consolidada por categoría</div>
            <div className="text-xs text-muted-foreground">· Click en una tarjeta para activarla</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {categoryCards.map(({ cat, summary, activa }) => (
              <CategoryCard key={cat} cat={cat} summary={summary} activa={activa} onClick={() => cambiarCategoria(cat)} marcaPropia={settings.marcaPropia} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            label={`Share volumen ${settings.marcaPropia}`}
            value={fmtPct(goldery?.shareVolumen ?? 0)}
            sub="Participación real calculada por toneladas"
            tone={(goldery?.shareVolumen ?? 0) > 0.1 ? "good" : (goldery?.shareVolumen ?? 0) > 0.05 ? "warn" : "bad"}
          />
          <KpiCard
            label="Ranking en categoría"
            value={`#${goldery?.rank ?? "—"}`}
            sub={`de ${brands.length} marcas activas`}
            tone="info"
          />
          <KpiCard
            label="Mayor oportunidad"
            value={oport?.segmento ?? "—"}
            sub={oport ? `Score ${oport.scoreOportunidad}/100 · ${oport.nivelOportunidad}` : ""}
            tone={oport?.nivelOportunidad === "Alta" ? "good" : "warn"}
          />
          <KpiCard
            label="Índice precio vs líder"
            value={fmtNum(idxPrecio, 0)}
            sub="Base 100 = líder · <95 valor · >105 sobreprecio"
            tone="info"
          />
          <KpiCard
            label="Brecha vs líder"
            value={fmtPct(gapShare)}
            sub={`${lider?.marca ?? "—"} lidera con ${fmtPct(lider?.shareVolumen ?? 0)}`}
            tone={gapShare > 0.15 ? "bad" : gapShare > 0.05 ? "warn" : "good"}
          />
          <KpiCard
            label="Ruta estratégica"
            value={oport ? rutaLabel(oport.recomendacion) : "—"}
            sub={`${segNoParticipa}/${segs.length} segmentos sin participación`}
            tone={oport?.recomendacion === "lanzar" ? "good" : oport?.recomendacion === "ajuste" ? "warn" : "neutral"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KpiCard label="Volumen categoría" value={`${fmtNum(totalVol / 1000)} L`} sub={`${fmtNum((totalVol / 1_000_000) * settings.densidad, 1)} ton totales`} />
          <KpiCard label="Ventas valor" value={fmtMoney(totalValor)} sub="Suma anual del autoservicio analizado" />
          <KpiCard label="Unidades vendidas" value={fmtNum(totalU)} sub="Base de cálculo de ranking y pareto" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">Share de volumen por marca</div>
                <div className="text-xs text-muted-foreground">Top 8 — barra en cyan = marca propia</div>
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
                      <Cell key={i} fill={d.esGoldery ? "var(--color-cyan)" : "var(--color-brand)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-sm font-semibold mb-1">Pareto de la categoría</div>
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

        <SoWhat>
          {goldery && lider ? (
            <>
              <b>{settings.marcaPropia}</b> participa con <b>{fmtPct(goldery.shareVolumen)}</b> frente a <b>{lider.marca}</b> ({fmtPct(lider.shareVolumen)}),
              con un índice de precio <b>{fmtNum(idxPrecio, 0)}</b>.{" "}
              {idxPrecio < 95 && gapShare > 0.1
                ? "El precio es competitivo pero el share es bajo: el problema probablemente no es precio sino empaque, claim o visibilidad en percha."
                : idxPrecio > 110
                ? "Existe un riesgo de sobreprecio que puede explicar la brecha contra el líder."
                : "Existen segmentos sin participación que concentran volumen relevante. Priorizar el mapa de oportunidad."}
            </>
          ) : "Carga la data o usa los datos de prueba para activar el diagnóstico."}
        </SoWhat>

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
  return r === "lanzar" ? "Nuevo lanzamiento" : r === "ajuste" ? "Ajuste táctico" : "No hacer nada";
}
function rutaDescripcion(r: "no-hacer" | "ajuste" | "lanzar") {
  return r === "lanzar"
    ? "El segmento pesa, hay brecha frente al líder y existe espacio para entrar con tamaño y claim correctos."
    : r === "ajuste"
    ? "Goldery ya está. El problema no parece ser precio sino comunicación, empaque o claim. Ajustar antes de invertir en producto."
    : "La oportunidad no justifica inversión. Concentrar recursos en segmentos de mayor peso.";
}

function CategoryCard({
  cat, summary, activa, onClick, marcaPropia,
}: {
  cat: string;
  summary: ReturnType<typeof categorySummary>;
  activa: boolean;
  onClick: () => void;
  marcaPropia: string;
}) {
  if (!summary.tieneData) {
    return (
      <button onClick={onClick} className={`text-left p-4 rounded-lg border ${activa ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"} transition`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold truncate">{cat}</div>
          {activa && <Chip tone="info">activa</Chip>}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">Sin data cargada</div>
      </button>
    );
  }
  const shareTone = summary.share > 0.1 ? "good" : summary.share > 0.05 ? "warn" : "bad";
  const idxTone = summary.indicePrecioPromedio === 0 ? "neutral" : summary.indicePrecioPromedio < 100 ? "good" : summary.indicePrecioPromedio < 110 ? "warn" : "bad";
  const claimTone = summary.claimsCubiertos >= 0.7 ? "good" : summary.claimsCubiertos >= 0.4 ? "warn" : "bad";
  const dot = (t: string) =>
    t === "good" ? "bg-[color:var(--color-success)]" : t === "warn" ? "bg-[color:var(--color-warning)]" : t === "bad" ? "bg-[color:var(--color-danger)]" : "bg-muted-foreground/40";
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border ${activa ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card hover:border-primary/50"} transition`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold truncate">{cat}</div>
        {activa ? <Chip tone="info">activa</Chip> : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat dot={dot(shareTone)} label={`Share ${marcaPropia}`} value={fmtPct(summary.share)} />
        <MiniStat dot={dot(idxTone)} label="Índice precio" value={summary.indicePrecioPromedio > 0 ? fmtNum(summary.indicePrecioPromedio, 0) : "—"} />
        <MiniStat dot={dot(claimTone)} label="Claims cubiertos" value={fmtPct(summary.claimsCubiertos)} />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        #{summary.ranking || "—"} de {summary.numMarcas} · más barato en {summary.segmentosMasBarato}/{summary.segmentosTotal} segm · {summary.claimsTengo}/{summary.claimsTotal} claims
      </div>
    </button>
  );
}
function MiniStat({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
