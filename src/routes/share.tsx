import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { brandRanking } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct, fmtMoney } from "@/components/goldery/ui";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Share de mercado · Goldery Analyzer" },
      { name: "description", content: "Ranking de marcas por volumen, unidades y valor con la posición de la marca propia." },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { data, settings } = useGoldery();
  const brands = useMemo(() => brandRanking(data), [data]);
  const goldery = brands.find((b) => b.marca === settings.marcaPropia) ?? brands.find((b) => b.esGoldery);

  const chart = brands.map((b) => ({ marca: b.marca, share: +(b.shareVolumen * 100).toFixed(1), esGoldery: b.esGoldery }));

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
      <PageHeader title="Share de mercado" subtitle="Ranking por volumen, unidades y valor." />
      <div className="p-8 space-y-6">
        <div className="panel p-5">
          <div className="text-sm font-semibold mb-3">Share de volumen por marca</div>
          <div className="h-[320px]">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="marca" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                  {chart.map((d, i) => <Cell key={i} fill={d.esGoldery ? "var(--color-brand)" : "var(--color-chart-1)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Marca</th>
                <th className="px-3 py-2 text-right">Toneladas</th>
                <th className="px-3 py-2 text-right">Volumen (L)</th>
                <th className="px-3 py-2 text-right">Share vol</th>
                <th className="px-3 py-2 text-right">Share unid</th>
                <th className="px-3 py-2 text-right">Share valor</th>
                <th className="px-3 py-2 text-right">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.marca} className={`border-t border-border ${b.esGoldery ? "bg-brand/10" : ""}`}>
                  <td className="px-3 py-2 tabular-nums">{b.rank}</td>
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-2">{b.marca}{b.esGoldery && <Chip tone="good">propia</Chip>}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.toneladas, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.volumenMl / 1000)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtPct(b.shareVolumen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(b.shareUnidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(b.shareValor)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(b.ventasValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <InsightCard tone={goldery && gap < 10 ? "good" : "warn"} title="Interpretación estratégica" body={interpretacion} />
      </div>
    </>
  );
}
