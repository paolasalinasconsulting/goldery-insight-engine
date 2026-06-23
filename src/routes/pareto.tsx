import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { paretoSkus } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";

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
  const { data, settings } = useGoldery();
  const pareto = useMemo(() => paretoSkus(data), [data]);
  const top80 = pareto.filter((p) => p.enPareto80);
  const golderyEn80 = top80.filter((p) => p.esGoldery).length;

  return (
    <>
      <PageHeader title="Pareto de SKUs" subtitle={`${top80.length} SKUs concentran el 80% del volumen de la categoría.`} />
      <div className="p-8 space-y-6">
        <InsightCard
          tone={golderyEn80 >= 2 ? "good" : golderyEn80 >= 1 ? "warn" : "bad"}
          title="Presencia de la marca propia en el Pareto"
          body={`${settings.marcaPropia} aparece con ${golderyEn80} SKU(s) dentro del 80% que mueve la categoría. ${
            golderyEn80 === 0
              ? "Goldery está fuera de los SKUs que mueven el volumen — el portafolio actual no compite donde se compra."
              : golderyEn80 < 2
              ? "Presencia mínima en el Pareto: existe espacio para sumar uno o dos SKUs clave en los tamaños más vendidos."
              : "Presencia razonable en el Pareto; el foco debe ser optimizar precio y claim, no portafolio."
          }`}
        />
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
