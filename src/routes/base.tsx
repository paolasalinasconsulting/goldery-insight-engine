import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader, Chip, fmtNum, fmtMoney } from "@/components/goldery/ui";
import { Pencil, X, Check } from "lucide-react";

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
  const { data, recalc, setVariedadOverride, clearVariedadOverride, reprocesarVariedades, variedadOverrides } = useGoldery();
  const [q, setQ] = useState("");
  const [soloPorClasificar, setSoloPorClasificar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const porClasificar = useMemo(() => data.filter((r) => r.variedad === "Por clasificar").length, [data]);

  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return data.filter((r) => {
      if (soloPorClasificar && r.variedad !== "Por clasificar") return false;
      return !t || r.marca.toLowerCase().includes(t) || r.descripcion.toLowerCase().includes(t);
    });
  }, [data, q, soloPorClasificar]);

  const commitEdit = (desc: string) => {
    const v = editVal.trim();
    if (v) setVariedadOverride(desc, v);
    else clearVariedadOverride(desc);
    setEditId(null);
    setEditVal("");
  };

  return (
    <>
      <PageHeader
        title="Base normalizada"
        subtitle={`${data.length} SKUs · tamaños convertidos a ml, volumen y precio/ml calculados.`}
        actions={
          <>
            <button onClick={reprocesarVariedades} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted" title="Re-extrae variedad desde la descripción con el diccionario actual">
              Re-procesar variedades
            </button>
            <button onClick={recalc} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              Recalcular
            </button>
          </>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca o producto…" className="flex-1 max-w-md px-3 py-2 text-sm rounded-md border border-input bg-card" />
          {porClasificar > 0 && (
            <button
              onClick={() => setSoloPorClasificar((s) => !s)}
              className={`text-xs px-3 py-2 rounded-md border ${soloPorClasificar ? "bg-[color:var(--color-warning)]/20 border-[color:var(--color-warning)]/60 text-foreground" : "border-border hover:bg-muted text-muted-foreground"}`}
            >
              {soloPorClasificar ? "◉" : "○"} {porClasificar} SKU{porClasificar === 1 ? "" : "s"} por clasificar en variedad
            </button>
          )}
          {Object.keys(variedadOverrides ?? {}).length > 0 && (
            <span className="text-xs text-muted-foreground">
              {Object.keys(variedadOverrides).length} variedad(es) editada(s) manualmente
            </span>
          )}
        </div>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <Th>Marca</Th><Th>Producto</Th><Th>Variedad</Th><Th>Empaque</Th><Th right>Tamaño (ml)</Th>
                  <Th>Segmento</Th><Th right>Unidades</Th><Th right>PVP</Th>
                  <Th right>Precio/ml</Th><Th right>Volumen (L)</Th><Th right>Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => {
                  const editing = editId === r.id;
                  const porClas = r.variedad === "Por clasificar";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2"><span className="flex items-center gap-2">{r.marca}{r.esGoldery && <Chip tone="good">propia</Chip>}</span></td>
                      <td className="px-3 py-2 text-muted-foreground">{r.descripcion}</td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              autoFocus
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(r.descripcion);
                                if (e.key === "Escape") { setEditId(null); setEditVal(""); }
                              }}
                              className="px-2 py-0.5 text-xs rounded border border-input bg-card w-32"
                              placeholder="Aroma / tipo"
                            />
                            <button onClick={() => commitEdit(r.descripcion)} className="text-[color:var(--color-success)]" title="Guardar"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { setEditId(null); setEditVal(""); }} className="text-muted-foreground" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={porClas ? "text-[color:var(--color-warning)] italic" : "text-muted-foreground"}>{r.variedad}</span>
                            <button
                              onClick={() => { setEditId(r.id); setEditVal(porClas ? "" : r.variedad); }}
                              className="text-muted-foreground/60 hover:text-foreground"
                              title="Editar variedad"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.empaque}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.tamanoMl)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.segmento}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.unidades)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.pvp)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${r.precioPorMl.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.volumenL, 1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.ventasValor)}</td>
                    </tr>
                  );
                })}
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
