import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { priceComparisonBySegment, priceMatrix } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, KpiCard, fmtPct } from "@/components/goldery/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

export const Route = createFileRoute("/precios")({
  head: () => ({
    meta: [
      { title: "Estrategia de precios · Category IQ" },
      { name: "description", content: "Índice de precio/ml de la marca propia vs la marca de referencia por segmento." },
    ],
  }),
  component: PreciosPage,
});

function PreciosPage() {
  const { data, settings, setComparacionPrecio, priceHistory, clearPriceHistory } = useGoldery();
  const matrix = useMemo(() => priceMatrix(data), [data]);
  const comps = useMemo(() => priceComparisonBySegment(data, settings), [data, settings]);

  // Feature 2 · Histórico: agrupar por segmento y fecha (día)
  const historico = useMemo(() => {
    const byFecha = new Map<string, Record<string, number | string>>();
    (priceHistory ?? []).forEach((h) => {
      const dia = h.fecha.slice(0, 10);
      const row = byFecha.get(dia) ?? { fecha: dia };
      if (h.indice > 0) row[h.segmento] = +h.indice.toFixed(1);
      byFecha.set(dia, row);
    });
    return [...byFecha.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [priceHistory]);
  const segmentosEnHist = useMemo(() => {
    const set = new Set<string>();
    (priceHistory ?? []).forEach((h) => { if (h.indice > 0) set.add(h.segmento); });
    return [...set];
  }, [priceHistory]);
  const HIST_PALETTE = ["#06B6D4", "#1E3A8A", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

  const marcasPorSegmento = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of matrix) {
      (m[r.segmento] ??= []).push(r.marca);
    }
    Object.values(m).forEach((arr) => arr.sort());
    return m;
  }, [matrix]);

  const verdes = comps.filter((c) => c.semaforo === "verde").length;
  const rojos = comps.filter((c) => c.semaforo === "rojo").length;
  const sinPresencia = comps.filter((c) => c.semaforo === "gris").length;

  return (
    <>
      <PageHeader
        title="Estrategia de precios"
        subtitle={`Precio/ml = PVP ÷ Presentación. Índice = (Precio/ml ${settings.marcaPropia} ÷ Precio/ml referencia) × 100. Independiente del módulo de share.`}
      />
      <div className="p-8 space-y-6">
        {/* Semáforo global */}
        <div className="panel p-5 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Semáforo global</div>
              <div className="mt-1 text-lg font-bold">
                {settings.marcaPropia} está más barata que la referencia en{" "}
                <span className="text-[color:var(--color-success)]">{verdes}</span> de {verdes + rojos} presentaciones donde compite
                {sinPresencia > 0 && <span className="text-muted-foreground text-sm font-medium"> · {sinPresencia} sin presencia</span>}
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <SemaphoreDot color="var(--color-success)" n={verdes} label="más barato" />
              <SemaphoreDot color="var(--color-danger)" n={rojos} label="más caro" />
              <SemaphoreDot color="var(--color-muted-foreground)" n={sinPresencia} label="sin PVP" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Segmentos en verde (índice < 100)" value={verdes} sub={`${settings.marcaPropia} más barata o igual`} tone="good" />
          <KpiCard label="Segmentos en rojo (índice ≥ 100)" value={rojos} sub={`${settings.marcaPropia} más cara`} tone={rojos > 0 ? "bad" : "good"} />
          <KpiCard label="Sin presencia" value={sinPresencia} sub="Segmento sin SKU de la marca propia" tone={sinPresencia > 0 ? "warn" : "good"} />
        </div>

        <InsightCard
          tone="info"
          title="Cómo leer el semáforo"
          body="Verde = índice < 100 (mi marca es más barata que la referencia). Rojo = índice ≥ 100 (mi marca es más cara). El emparejamiento por defecto usa la marca de mayor volumen del segmento; puedes cambiar la referencia manualmente en la columna 'Comparar contra'."
        />

        {/* Feature 2 · Histórico */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Evolución del índice de precio vs referencia</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Snapshot automático diario. {historico.length} punto{historico.length === 1 ? "" : "s"} registrado{historico.length === 1 ? "" : "s"} · línea 100 = paridad con la marca de referencia.
              </div>
            </div>
            {historico.length > 0 && (
              <button
                onClick={() => { if (confirm("¿Borrar todo el histórico de precios de esta categoría?")) clearPriceHistory(); }}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground"
              >
                Reset histórico
              </button>
            )}
          </div>
          {historico.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
              Sin histórico aún. Cada vez que se recalcule con data válida se registra un snapshot diario automáticamente.
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <LineChart data={historico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={100} stroke="var(--color-warning)" strokeDasharray="4 4" label={{ value: "Paridad (100)", fill: "var(--color-warning)", fontSize: 10, position: "right" }} />
                  {segmentosEnHist.map((seg, i) => (
                    <Line key={seg} type="monotone" dataKey={seg} stroke={HIST_PALETTE[i % HIST_PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>



        <div className="panel overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Segmento</th>
                <th className="px-3 py-2 text-left">Comparar contra</th>
                <th className="px-3 py-2 text-right">Precio/ml ref.</th>
                <th className="px-3 py-2 text-right">Precio/ml {settings.marcaPropia}</th>
                <th className="px-3 py-2 text-right">Índice</th>
                <th className="px-3 py-2 text-center">Semáforo</th>
                <th className="px-3 py-2 text-right">Peso segmento</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => {
                const marcas = marcasPorSegmento[c.segmento] ?? [];
                const totalVol = comps.reduce((s, x) => s + x.volumenSegmento, 0) || 1;
                return (
                  <tr key={c.segmento} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{c.segmento}</td>
                    <td className="px-3 py-2">
                      <select
                        value={c.marcaComparada}
                        onChange={(e) => setComparacionPrecio(c.segmento, e.target.value)}
                        className="text-xs px-2 py-1 rounded-md border border-input bg-card"
                      >
                        {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">${c.precioMlComparado.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.miMarcaPresente ? `$${c.precioMlMiMarca.toFixed(4)}` : <Chip tone="warn">sin PVP</Chip>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">
                      {c.indice > 0 ? c.indice.toFixed(0) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.semaforo === "verde" && <span className="inline-block h-3 w-3 rounded-full bg-[color:var(--color-success)]" title="Verde: índice < 100" />}
                      {c.semaforo === "rojo" && <span className="inline-block h-3 w-3 rounded-full bg-[color:var(--color-danger)]" title="Rojo: índice ≥ 100" />}
                      {c.semaforo === "gris" && <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40" title="Sin presencia de la marca propia" />}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmtPct(c.volumenSegmento / totalVol)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-3">Matriz completa precio/ml por marca × segmento</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Segmento</th>
                  <th className="px-2 py-1.5 text-left">Marca</th>
                  <th className="px-2 py-1.5 text-right">Precio/ml</th>
                  <th className="px-2 py-1.5 text-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {matrix
                  .slice()
                  .sort((a, b) => a.segmento.localeCompare(b.segmento) || b.volumenMl - a.volumenMl)
                  .map((r, i) => (
                    <tr key={i} className={`border-t border-border ${r.esGoldery ? "bg-[color:var(--color-cyan)]/5" : ""}`}>
                      <td className="px-2 py-1 text-muted-foreground">{r.segmento}</td>
                      <td className="px-2 py-1 font-medium">{r.marca}{r.esGoldery && <span className="ml-1 text-[9px] text-[color:var(--color-cyan)]">◆</span>}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${r.precioMlPromedio.toFixed(4)}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{r.unidades.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function SemaphoreDot({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-lg font-bold tabular-nums">{n}</span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}
