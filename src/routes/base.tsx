import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader, Chip, fmtNum, fmtMoney } from "@/components/goldery/ui";

export const Route = createFileRoute("/base")({
  head: () => ({
    meta: [
      { title: "Base normalizada · Goldery Analyzer" },
      { name: "description", content: "Tabla limpia con tamaños, volumen y precios por SKU lista para análisis." },
    ],
  }),
  component: BasePage,
});

function BasePage() {
  const { data, recalc } = useGoldery();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return data.filter((r) => !t || r.marca.toLowerCase().includes(t) || r.descripcion.toLowerCase().includes(t));
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Base normalizada"
        subtitle={`${data.length} SKUs · tamaños convertidos a ml, volumen y precio/ml calculados.`}
        actions={
          <button onClick={recalc} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
            Recalcular
          </button>
        }
      />
      <div className="p-8 space-y-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca o producto…" className="w-full max-w-md px-3 py-2 text-sm rounded-md border border-input bg-card" />
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <Th>Marca</Th><Th>Producto</Th><Th>Empaque</Th><Th right>Tamaño (ml)</Th>
                  <Th>Segmento</Th><Th right>Unidades</Th><Th right>PVP</Th>
                  <Th right>Precio/ml</Th><Th right>Volumen (L)</Th><Th right>Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2"><span className="flex items-center gap-2">{r.marca}{r.esGoldery && <Chip tone="good">propia</Chip>}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{r.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.empaque}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.tamanoMl)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.segmento}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.unidades)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.pvp)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${r.precioPorMl.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.volumenL, 1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.ventasValor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <div className="p-3 text-xs text-muted-foreground text-center border-t border-border">Mostrando 200 de {rows.length} filas.</div>}
        </div>
      </div>
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-${right ? "right" : "left"} font-medium uppercase tracking-wide`}>{children}</th>;
}
