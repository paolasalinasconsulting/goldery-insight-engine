import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments, priceDiagnosis } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtMoney, fmtPct } from "@/components/goldery/ui";

export const Route = createFileRoute("/precios")({
  head: () => ({
    meta: [
      { title: "Estrategia de precios · Goldery Analyzer" },
      { name: "description", content: "Índice de precio por ml de la marca propia vs el líder por segmento." },
    ],
  }),
  component: PreciosPage,
});

function PreciosPage() {
  const { data, settings } = useGoldery();
  const segs = useMemo(() => analyzeSegments(data, settings), [data, settings]);
  const conPresencia = segs.filter((s) => s.participaGoldery);

  const baratos = conPresencia.filter((s) => s.indicePrecio < 85).length;
  const caros = conPresencia.filter((s) => s.indicePrecio > 115).length;

  return (
    <>
      <PageHeader title="Estrategia de precios" subtitle="Índice de precio/ml vs el líder del segmento." />
      <div className="p-8 space-y-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <InsightCard
            tone={baratos > 0 ? "warn" : "good"}
            title={`Segmentos donde Goldery está muy por debajo: ${baratos}`}
            body="Diferenciales mayores al 15% pueden erosionar percepción de calidad si no comunican un beneficio claro de ahorro."
          />
          <InsightCard
            tone={caros > 0 ? "bad" : "good"}
            title={`Segmentos con sobreprecio alto: ${caros}`}
            body="Sobreprecio mayor a 15% sin un claim de valor superior reduce conversión y rotación."
          />
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Segmento</th>
                <th className="px-3 py-2 text-left">Líder</th>
                <th className="px-3 py-2 text-right">Precio/ml líder</th>
                <th className="px-3 py-2 text-right">Precio/ml Goldery</th>
                <th className="px-3 py-2 text-right">Índice</th>
                <th className="px-3 py-2 text-left">Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {segs.map((s) => {
                const dx = priceDiagnosis(s.indicePrecio, settings.umbralIndicePrecio);
                return (
                  <tr key={s.segmento} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{s.segmento}</td>
                    <td className="px-3 py-2">{s.lider}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${s.precioMlLider.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.participaGoldery ? `$${s.precioMlGoldery.toFixed(4)}` : <Chip tone="bad">sin SKU</Chip>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {s.indicePrecio > 0 ? s.indicePrecio.toFixed(0) : "—"}
                    </td>
                    <td className="px-3 py-2"><Chip tone={dx.tone}>{dx.label}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          {conPresencia.map((s) => {
            const dx = priceDiagnosis(s.indicePrecio, settings.umbralIndicePrecio);
            return (
              <div key={s.segmento} className="panel p-4 text-sm">
                <span className="font-semibold">{s.segmento}: </span>
                <span className="text-muted-foreground">
                  {dx.level === "muy-barato"
                    ? `Precio/ml ${(100 - s.indicePrecio).toFixed(0)}% por debajo de ${s.lider}. Revisar si el diferencial comunica ahorro o si erosiona calidad.`
                    : dx.level === "valor"
                    ? `Ventaja de valor (${(100 - s.indicePrecio).toFixed(0)}% bajo el líder). Si el share sigue bajo, el problema no es precio sino empaque/claim.`
                    : dx.level === "paridad"
                    ? `Paridad con ${s.lider}. La batalla se gana con claim y visibilidad en percha.`
                    : dx.level === "moderado"
                    ? `Sobreprecio moderado (${(s.indicePrecio - 100).toFixed(0)}%): debe estar justificado por un beneficio superior comunicado.`
                    : `Sobreprecio alto (${(s.indicePrecio - 100).toFixed(0)}%): riesgo de baja conversión vs ${s.lider}. ${fmtMoney(0)}`}
                  {" "}Goldery tiene {fmtPct(s.shareGolderyEnSegmento)} de share en este segmento.
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
