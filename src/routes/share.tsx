import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { brandRanking, segmentBrandShare, varietyShare, fairShareBySegment, fairShareByVariedad, type FairShareRow } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Legend,
} from "recharts";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Share de mercado · Category IQ" },
      { name: "description", content: "Share por volumen: total, por segmento de tamaño y por variedad/aroma." },
    ],
  }),
  component: SharePage,
});

const PALETTE = ["#1E3A8A", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const MI_COLOR = "#06B6D4";

function SharePage() {
  const { data, settings } = useGoldery();
  const brands = useMemo(() => brandRanking(data), [data]);
  const goldery = brands.find((b) => b.marca === settings.marcaPropia) ?? brands.find((b) => b.esGoldery);
  const stacks = useMemo(() => segmentBrandShare(data, settings), [data, settings]);
  const variedades = useMemo(() => varietyShare(data), [data]);
  const fairSeg = useMemo(() => fairShareBySegment(data), [data]);
  const fairVar = useMemo(() => fairShareByVariedad(data), [data]);

  const chart = brands.map((b) => ({ marca: b.marca, share: +(b.shareVolumen * 100).toFixed(1), esGoldery: b.esGoldery }));
  const donut = brands.map((b, i) => ({ name: b.marca, value: b.volumenMl, esGoldery: b.esGoldery, color: b.esGoldery ? MI_COLOR : PALETTE[(i + 1) % PALETTE.length] }));

  // Stacked bars: cada segmento con top-N marcas + "Otros"
  const topMarcas = brands.slice(0, 6).map((b) => b.marca);
  const marcasParaStack = Array.from(new Set([...topMarcas, ...(goldery ? [goldery.marca] : [])]));
  const stackChart = stacks.map((s) => {
    const row: Record<string, number | string> = { segmento: s.segmento };
    let otros = 0;
    Object.entries(s.marcas).forEach(([m, share]) => {
      if (marcasParaStack.includes(m)) row[m] = +(share * 100).toFixed(1);
      else otros += share;
    });
    if (otros > 0) row["Otros"] = +(otros * 100).toFixed(1);
    return row;
  });
  const marcasKeys = [...marcasParaStack, "Otros"];

  const varChart = variedades.map((v) => ({ variedad: v.variedad, share: +(v.shareVolumen * 100).toFixed(1), shareG: +(v.shareGolderyEnVariedad * 100).toFixed(1) }));

  const lider = brands[0];
  const gap = lider && goldery ? (lider.shareVolumen - goldery.shareVolumen) * 100 : 0;
  const interpretacion = goldery
    ? `${settings.marcaPropia} ocupa el puesto #${goldery.rank} con ${fmtPct(goldery.shareVolumen)} de share volumen. ` +
      (gap > 20
        ? `Brecha de ${gap.toFixed(1)} pts vs el líder ${lider.marca}: la categoría está concentrada y será costoso ganar share por volumen puro; mejor enfocar por segmento.`
        : gap > 8
        ? `Brecha de ${gap.toFixed(1)} pts vs ${lider.marca}: hay espacio para crecer compitiendo segmento por segmento.`
        : `Posición competitiva sólida vs ${lider.marca}; el foco debe ser defender y optimizar mix.`)
    : "La marca propia no aparece en la data.";

  return (
    <>
      <PageHeader title="Share de mercado" subtitle="Métrica principal: participación en VOLUMEN (unidades × presentación normalizada)." />
      <div className="p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="panel p-5 lg:col-span-2">
            <div className="text-sm font-semibold mb-1">Share de volumen por marca</div>
            <div className="text-xs text-muted-foreground mb-3">Cyan = {settings.marcaPropia}. Métrica: % del volumen total de la categoría.</div>
            <div className="h-[320px]">
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="marca" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                  <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                    {chart.map((d, i) => <Cell key={i} fill={d.esGoldery ? MI_COLOR : "var(--color-brand)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel p-5">
            <div className="text-sm font-semibold mb-1">Distribución del share</div>
            <div className="text-xs text-muted-foreground mb-3">Vista de dona por marca.</div>
            <div className="h-[320px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} formatter={(v: number) => fmtNum(v / 1000) + " L"} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-1">Share por agrupación de tamaño</div>
          <div className="text-xs text-muted-foreground mb-3">Barras apiladas: composición interna de cada segmento por marca (% de volumen del segmento).</div>
          <div className="h-[360px]">
            <ResponsiveContainer>
              <BarChart data={stackChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="segmento" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {marcasKeys.map((m, i) => (
                  <Bar
                    key={m}
                    dataKey={m}
                    stackId="a"
                    fill={m === settings.marcaPropia || settings.marcasPropias.includes(m) ? MI_COLOR : PALETTE[i % PALETTE.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature 1 · Fair Share */}
        <div className="panel p-5 space-y-5">
          <div>
            <div className="text-sm font-semibold">Fair Share — ¿dónde estoy sobre o sub-indexado?</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Comparación de mi share total ({fmtPct(goldery?.shareVolumen ?? 0)}) contra mi share dentro de cada segmento y cada variedad.
              Flecha verde = sobreindexado (gano más volumen del que me toca). Flecha roja = sub-indexado (pierdo volumen que me correspondería).
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <FairShareTable titulo="Por agrupación de tamaño" rows={fairSeg} marcaPropia={settings.marcaPropia} />
            <FairShareTable titulo="Por variedad / aroma" rows={fairVar} marcaPropia={settings.marcaPropia} />
          </div>
        </div>



        <div className="grid lg:grid-cols-2 gap-6">
          <div className="panel p-5">
            <div className="text-sm font-semibold mb-1">Share por variedad / aroma</div>
            <div className="text-xs text-muted-foreground mb-3">Peso de cada variedad en el volumen total de la categoría.</div>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <BarChart data={varChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="variedad" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                  <Bar dataKey="share" name="Share categoría" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="shareG" name={`${settings.marcaPropia} dentro de la variedad`} fill={MI_COLOR} radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <InsightCard tone={goldery && gap < 10 ? "good" : "warn"} title="Interpretación estratégica" body={interpretacion} />
        </div>

        <div className="panel overflow-hidden">
          <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border">
            Tabla de ranking · <span className="font-semibold text-foreground">share volumen</span> es la métrica principal.
            Share unidades y share valor se muestran como referencia únicamente.
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Marca</th>
                <th className="px-3 py-2 text-right">Toneladas</th>
                <th className="px-3 py-2 text-right">Volumen (L)</th>
                <th className="px-3 py-2 text-right bg-[color:var(--color-cyan)]/10">Share volumen</th>
                <th className="px-3 py-2 text-right text-muted-foreground/70">Share unid (ref.)</th>
                <th className="px-3 py-2 text-right text-muted-foreground/70">Share valor (ref.)</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.marca} className={`border-t border-border ${b.esGoldery ? "bg-[color:var(--color-cyan)]/5" : ""}`}>
                  <td className="px-3 py-2 tabular-nums">{b.rank}</td>
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-2">{b.marca}{b.esGoldery && <Chip tone="good">propia</Chip>}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.toneladas, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.volumenMl / 1000)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-[color:var(--color-brand)] bg-[color:var(--color-cyan)]/5">{fmtPct(b.shareVolumen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(b.shareUnidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(b.shareValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function FairShareTable({ titulo, rows, marcaPropia }: { titulo: string; rows: FairShareRow[]; marcaPropia: string }) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.gapPts) - Math.abs(a.gapPts));
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{titulo}</div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-1.5 text-left font-medium">Segmento</th>
            <th className="py-1.5 text-right font-medium">Peso</th>
            <th className="py-1.5 text-right font-medium">Share {marcaPropia}</th>
            <th className="py-1.5 text-right font-medium">Brecha</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const color = r.indicador === "sobre" ? "text-[color:var(--color-success)]"
              : r.indicador === "sub" ? "text-[color:var(--color-danger)]"
              : "text-muted-foreground";
            const arrow = r.indicador === "sobre" ? "▲" : r.indicador === "sub" ? "▼" : "•";
            return (
              <tr key={r.segmento} className="border-b border-border/50">
                <td className="py-1.5 truncate max-w-[180px]">{r.segmento}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(r.pesoSegmento)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtPct(r.shareEnSegmento)}</td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${color}`}>
                  {arrow} {r.gapPts > 0 ? "+" : ""}{r.gapPts.toFixed(1)} pts
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Referencia: mi share total = {fmtPct(rows[0]?.shareReferencia ?? 0)}.
      </div>
    </div>
  );
}
