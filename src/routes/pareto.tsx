import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGoldery } from "@/lib/goldery/store";
import {
  paretoSkus,
  paretoBrandDiagnosis,
  paretoBySegment,
  unclassifiedStats,
  type ParetoSegmentBlock,
  type ParetoSegmentBrandRow,
} from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/pareto")({
  head: () => ({
    meta: [
      { title: "Pareto por segmento · Goldery Analyzer" },
      { name: "description", content: "Arena competitiva por tamaño: qué marcas concentran el volumen en cada segmento." },
    ],
  }),
  component: ParetoPage,
});

function ParetoPage() {
  const { data, settings, rawRows, mapping } = useGoldery();
  const [view, setView] = useState<"segmento" | "sku">("segmento");
  const uncl = useMemo(() => unclassifiedStats(rawRows, mapping, data), [rawRows, mapping, data]);

  return (
    <>
      <PageHeader
        title="Pareto por segmento"
        subtitle="La categoría no es una sola arena: cada tamaño tiene su propio líder, precio de referencia y ganadores. Aquí ves quién concentra el volumen en cada segmento."
      />
      <div className="p-8 space-y-6">
        {uncl.skus > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-4">
            <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning)] shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">
                {uncl.skus} SKUs ({(uncl.pctUnidades * 100).toFixed(1)}% de las unidades) sin tamaño asignado
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                Estos SKUs no entran al análisis porque no pueden convertirse a volumen. Ejemplos: {uncl.ejemplos.join(" · ")}.
              </div>
              <Link to="/upload" className="inline-block mt-2 text-xs text-[color:var(--color-brand)] hover:underline font-medium">
                → Completar tamaño en la carga de datos
              </Link>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-border">
          <TabBtn active={view === "segmento"} onClick={() => setView("segmento")}>Por segmento</TabBtn>
          <TabBtn active={view === "sku"} onClick={() => setView("sku")}>Ver por SKU</TabBtn>
        </div>

        {view === "segmento" ? <SegmentView /> : <SkuView />}
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        active
          ? "border-[color:var(--color-brand)] text-[color:var(--color-brand)]"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ================== Vista por SEGMENTO ================== */

function SegmentView() {
  const { data, settings } = useGoldery();
  const blocks = useMemo(() => paretoBySegment(data, settings), [data, settings]);

  if (blocks.length === 0) {
    return <div className="panel p-6 text-sm text-muted-foreground">No hay datos suficientes para armar el análisis por segmento.</div>;
  }

  return (
    <div className="space-y-5">
      {blocks.map((b) => (
        <SegmentBlock key={b.segmento} block={b} marcaPropia={settings.marcaPropia} />
      ))}
    </div>
  );
}

function SegmentBlock({ block, marcaPropia }: { block: ParetoSegmentBlock; marcaPropia: string }) {
  const [expandAll, setExpandAll] = useState(false);
  const [open, setOpen] = useState(true);

  const topN = 6;
  const rowsBase = expandAll ? block.brands : block.brands.slice(0, topN);
  const mi = block.miMarcaRow;
  const miIncluida = mi ? rowsBase.some((r) => r.marca === mi.marca) : true;
  const rowsShown = mi && !miIncluida ? [...rowsBase, mi] : rowsBase;

  return (
    <div className="panel overflow-hidden">
      {/* Encabezado */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30 hover:bg-muted/50 transition text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-base font-bold text-foreground">{block.segmento}</div>
            <Chip tone="info">{fmtPct(block.pesoCategoria)} de la categoría</Chip>
            {!block.miMarcaPresente && <Chip tone="bad">sin presencia de {marcaPropia}</Chip>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            <b className="text-foreground tabular-nums">{fmtNum(block.toneladas, 1)} t</b> · líder{" "}
            <b className="text-foreground">{block.liderMarca}</b> con <b className="tabular-nums">{fmtNum(block.liderToneladas, 1)} t</b>
            {mi && (
              <> · {marcaPropia}: <b className="text-[color:var(--color-brand)] tabular-nums">{fmtPct(mi.shareSegmento)}</b> del segmento · posición #{mi.posicion}</>
            )}
          </div>
        </div>
      </button>

      {open && (
        <>
          {/* Alertas de precio para Mi Marca */}
          {mi && mi.indicePrecio > 0 && mi.indicePrecio < 80 && mi.shareSegmento < 0.05 && (
            <div className="px-5 py-3 border-b border-border bg-[color:var(--color-danger)]/10 text-xs">
              <b className="text-[color:var(--color-danger)]">Gap &gt;20%</b> — riesgo de percepción de calidad: el descuento no está convirtiendo, revisar empaque/RPC.
            </div>
          )}
          {mi && mi.indicePrecio > 120 && (
            <div className="px-5 py-3 border-b border-border bg-[color:var(--color-warning)]/10 text-xs">
              <b className="text-[color:var(--color-warning)]">Sobreprecio &gt;20%</b> — requiere justificación funcional visible en empaque.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">Empaque</th>
                  <th className="px-3 py-2 text-right">ML</th>
                  <th className="px-3 py-2 text-right">Unidades</th>
                  <th className="px-3 py-2 text-right">Toneladas</th>
                  <th className="px-3 py-2 text-right">Share segm.</th>
                  <th className="px-3 py-2 text-right">Acumulado</th>
                  <th className="px-3 py-2 text-right">Share cat.</th>
                  <th className="px-3 py-2 text-right">PVP</th>
                  <th className="px-3 py-2 text-right">$/ml</th>
                  <th className="px-3 py-2 text-right">Índice precio</th>
                  <th className="px-3 py-2 text-left">Pareto 80</th>
                </tr>
              </thead>
              <tbody>
                {rowsShown.map((r) => (
                  <BrandRow key={r.marca} r={r} />
                ))}
                {!block.miMarcaPresente && (
                  <tr className="border-t border-border bg-[color:var(--color-danger)]/10">
                    <td colSpan={13} className="px-3 py-2 text-[color:var(--color-danger)] font-semibold text-center text-xs">
                      {marcaPropia} — SIN PRESENCIA en este segmento
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {block.brands.length > topN && (
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                Mostrando {rowsShown.length} de {block.brands.length} marcas del segmento
              </div>
              <button
                onClick={() => setExpandAll((v) => !v)}
                className="text-xs text-[color:var(--color-brand)] hover:underline font-medium"
              >
                {expandAll ? "Colapsar" : `Ver todas las marcas del segmento (${block.brands.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BrandRow({ r }: { r: ParetoSegmentBrandRow }) {
  // Resaltados: mi marca dorada, líder azul claro
  const rowClass = r.esGoldery
    ? "bg-[#facc15]/15 border-l-4 border-l-[#facc15]"
    : r.esLiderSegmento
    ? "bg-[color:var(--color-brand)]/10 border-l-4 border-l-[color:var(--color-brand)]"
    : r.enPareto80
    ? "bg-muted/20"
    : "";

  const idx = r.indicePrecio;
  const idxTone =
    idx === 0 ? "text-muted-foreground"
      : idx < 95 ? "text-[color:var(--color-success)]"
      : idx <= 105 ? "text-[color:var(--color-warning)]"
      : "text-[color:var(--color-danger)]";

  return (
    <tr className={`border-t border-border ${rowClass}`}>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.posicion}</td>
      <td className="px-3 py-2 font-semibold whitespace-nowrap">
        {r.marca}
        {r.esGoldery && <Chip tone="good">mi marca</Chip>}
        {r.esLiderSegmento && !r.esGoldery && <Chip tone="info">líder</Chip>}
      </td>
      <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{r.empaqueRepresentativo}</td>
      <td className="px-3 py-2 text-right tabular-nums">{r.tamanoRepresentativoMl ? fmtNum(r.tamanoRepresentativoMl) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.unidades)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.toneladas, 2)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtPct(r.shareSegmento)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(r.acumulado)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtPct(r.shareCategoria, 2)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{r.pvpPromedio > 0 ? fmtNum(r.pvpPromedio, 2) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{r.precioPorMl > 0 ? r.precioPorMl.toFixed(4) : "—"}</td>
      <td className={`px-3 py-2 text-right tabular-nums font-bold ${idxTone}`}>
        {r.esLiderSegmento ? "100 (ref)" : idx > 0 ? fmtNum(idx, 0) : "—"}
      </td>
      <td className="px-3 py-2">{r.enPareto80 ? <Chip tone="good">en 80%</Chip> : <Chip tone="neutral">cola</Chip>}</td>
    </tr>
  );
}

/* ================== Vista por SKU (clásica) ================== */

function SkuView() {
  const { data, settings } = useGoldery();
  const pareto = useMemo(() => paretoSkus(data), [data]);
  const diag = useMemo(() => paretoBrandDiagnosis(pareto, data, settings.marcaPropia), [pareto, data, settings.marcaPropia]);
  const top80 = pareto.filter((p) => p.enPareto80);

  const tone: "good" | "warn" | "bad" =
    diag.caso === "ok" ? "good"
      : diag.caso === "brecha-conversion" ? "warn"
      : "bad";
  const title =
    diag.caso === "ok" ? "Presencia sólida en el Pareto"
      : diag.caso === "brecha-portafolio" ? "Brecha de portafolio"
      : diag.caso === "brecha-conversion" ? "Brecha de conversión"
      : "Sin datos de la marca propia";

  return (
    <div className="space-y-5">
      <div className="text-xs text-muted-foreground">
        {top80.length} SKUs concentran el 80% del volumen. Útil para identificar presentaciones ganadoras individuales.
      </div>
      <InsightCard tone={tone} title={title} body={diag.mensaje} />

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
              <tr key={p.id} className={`border-t border-border ${p.esGoldery ? "bg-[#facc15]/15" : ""}`}>
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
  );
}
