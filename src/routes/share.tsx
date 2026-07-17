import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { brandRanking, segmentBrandShare, varietyShare, fairShareBySegment, fairShareByVariedad, fairShareByEmpaque, packagingShare, sizePackagingMatrix, unclassifiedStats, type FairShareRow, type PackagingShareRow, type SizePackagingMatrix } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, fmtNum, fmtPct } from "@/components/goldery/ui";
import { AlertTriangle } from "lucide-react";
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
  const { data, settings, rawRows, mapping } = useGoldery();
  const brands = useMemo(() => brandRanking(data), [data]);
  const uncl = useMemo(() => unclassifiedStats(rawRows, mapping, data), [rawRows, mapping, data]);
  const goldery = brands.find((b) => b.marca === settings.marcaPropia) ?? brands.find((b) => b.esGoldery);
  const stacks = useMemo(() => segmentBrandShare(data, settings), [data, settings]);
  const variedades = useMemo(() => varietyShare(data), [data]);
  const fairSeg = useMemo(() => fairShareBySegment(data), [data]);
  const fairVar = useMemo(() => fairShareByVariedad(data), [data]);
  const fairEmp = useMemo(() => fairShareByEmpaque(data), [data]);
  const empaques = useMemo(() => packagingShare(data, settings), [data, settings]);
  const matrixSE = useMemo(() => sizePackagingMatrix(data, settings), [data, settings]);

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
        {uncl.skus > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-4">
            <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning)] shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">
                {uncl.skus} SKUs ({(uncl.pctUnidades * 100).toFixed(1)}% de las unidades) sin tamaño asignado
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                Estos SKUs se excluyen de los segmentos y del cálculo de volumen — los shares por segmento pueden estar distorsionados. Ejemplos: {uncl.ejemplos.join(" · ")}.
              </div>
              <Link to="/upload" className="inline-block mt-2 text-xs text-[color:var(--color-brand)] hover:underline font-medium">
                → Completar tamaño en la carga de datos
              </Link>
            </div>
          </div>
        )}
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

          <details className="group rounded-md border border-border bg-muted/30">
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs font-semibold text-foreground flex items-center justify-between">
              <span>¿Cómo leer esta tabla?</span>
              <span className="text-muted-foreground text-[10px] group-open:hidden">Expandir</span>
              <span className="text-muted-foreground text-[10px] hidden group-open:inline">Cerrar</span>
            </summary>
            <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Imagina que tu marca tiene el <span className="font-semibold text-foreground">{fmtPct(goldery?.shareVolumen ?? 0)}</span> de todo el mercado.
                Si tu venta se repartiera de forma pareja, deberías tener ese mismo {fmtPct(goldery?.shareVolumen ?? 0)} en cada tamaño y en cada variedad.
                Esta tabla compara tu participación real en cada segmento contra ese punto de referencia:
              </p>
              <ul className="space-y-1 pl-1">
                <li><span className="text-[color:var(--color-success)] font-semibold">▲ Flecha verde (+):</span> en este segmento vendes <strong>más</strong> de lo que te tocaría — es una fortaleza donde tu producto conecta bien.</li>
                <li><span className="text-[color:var(--color-danger)] font-semibold">▼ Flecha roja o punto (−):</span> en este segmento vendes <strong>menos</strong> de lo que te tocaría — o no participas, o tu producto no está convirtiendo ahí.</li>
                <li>La columna <span className="font-semibold text-foreground">PESO</span> te dice qué tan grande es cada segmento dentro de la categoría. Una brecha negativa en un segmento de mucho peso es más grave que en uno pequeño: es donde más volumen estás dejando sobre la mesa.</li>
              </ul>
              <div className="pt-1 text-[10px] font-mono text-muted-foreground/80">
                Fórmula: Brecha = Share en el segmento − Share total de la marca (en puntos porcentuales).
              </div>
            </div>
          </details>

          {(goldery?.shareVolumen ?? 0) > 0 && (goldery?.shareVolumen ?? 0) < 0.03 && (
            <div className="rounded-md border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-3 text-xs text-foreground leading-relaxed">
              <span className="font-semibold">⚠ Cuidado con el espejismo:</span> tu share total es bajo ({fmtPct(goldery?.shareVolumen ?? 0)}),
              por lo que superar tu promedio es fácil y las flechas verdes pueden dar una falsa sensación de fortaleza.
              Prioriza la lectura por <span className="font-semibold">PESO</span> del segmento: la pregunta clave no es
              "¿supero mi promedio?" sino <span className="italic">"¿participo donde está el volumen?"</span>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <FairShareTable titulo="Por agrupación de tamaño" rows={fairSeg} marcaPropia={settings.marcaPropia} />
            <FairShareTable titulo="Por variedad / aroma" rows={fairVar} marcaPropia={settings.marcaPropia} />
            <FairShareTable titulo="Por tipo de empaque" rows={fairEmp} marcaPropia={settings.marcaPropia} />
          </div>
        </div>

        {/* Empaque · Share por tipo de empaque */}
        <EmpaqueSection empaques={empaques} marcaPropia={settings.marcaPropia} />

        {/* Empaque · Matriz Tamaño × Empaque */}
        <MatrizTamanoEmpaque matrix={matrixSE} marcaPropia={settings.marcaPropia} />



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
          <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border space-y-1.5">
            <div>
              Tabla de ranking · <span className="font-semibold text-foreground">share volumen</span> es la métrica principal.
              Share unidades y share valor se muestran como referencia únicamente.
            </div>
            <div>
              <span className="font-semibold text-foreground">Share unidades</span>: % de piezas/frascos vendidos por la marca sobre el total de unidades de la categoría. No distingue tamaño, así que una marca fuerte en presentaciones pequeñas (sachets, 500 ml) puede verse inflada aquí frente a share volumen.
            </div>
            <div>
              <span className="font-semibold text-foreground">Share valor</span>: % de facturación en dólares (PVP × unidades) de la marca sobre el total de la categoría. Refleja poder monetario y se infla con marcas premium o de precio alto, aunque muevan menos producto que el líder en volumen.
            </div>
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
  const maxPeso = rows.reduce((m, r) => Math.max(m, r.pesoSegmento), 0);
  const tooltipFor = (r: FairShareRow): string => {
    const shareSeg = fmtPct(r.shareEnSegmento);
    const shareRef = fmtPct(r.shareReferencia);
    const peso = fmtPct(r.pesoSegmento);
    const esMasGrande = r.pesoSegmento === maxPeso && maxPeso > 0;
    if (r.shareEnSegmento <= 0) {
      return `No participas en este segmento, que representa el ${peso} del mercado: evalúa si entrar.`;
    }
    if (r.indicador === "sobre") {
      return `Aquí tienes ${shareSeg} vs tu promedio de ${shareRef}: este segmento es una fortaleza.`;
    }
    if (r.indicador === "sub") {
      if (esMasGrande) {
        return `Aquí tienes ${shareSeg} en el segmento MÁS GRANDE de la categoría (${peso} del mercado): es tu mayor oportunidad de crecimiento.`;
      }
      return `Aquí tienes ${shareSeg} vs tu promedio de ${shareRef} en un segmento que pesa ${peso}: estás dejando volumen sobre la mesa.`;
    }
    return `Participación pareja con tu promedio (${shareRef}) en un segmento que pesa ${peso}.`;
  };
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
            const tip = tooltipFor(r);
            return (
              <tr key={r.segmento} className="border-b border-border/50">
                <td className="py-1.5 truncate max-w-[180px]">{r.segmento}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(r.pesoSegmento)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtPct(r.shareEnSegmento)}</td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${color} cursor-help`} title={tip}>
                  {arrow} {r.gapPts > 0 ? "+" : ""}{r.gapPts.toFixed(1)} pts
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Referencia: mi share total = {fmtPct(rows[0]?.shareReferencia ?? 0)}. Pasa el cursor sobre la brecha para ver la interpretación.
      </div>
    </div>
  );
}

function EmpaqueSection({ empaques, marcaPropia }: { empaques: PackagingShareRow[]; marcaPropia: string }) {
  if (empaques.length === 0) return null;
  const top = empaques.slice(0, 10);
  const totalMi = empaques.reduce((s, e) => s + e.volumenMiMarca, 0);
  const chart = top.map((e) => ({
    empaque: e.empaque,
    share: +(e.shareVolumen * 100).toFixed(1),
    shareMi: +(e.shareMiMarcaEnEmpaque * 100).toFixed(1),
  }));
  return (
    <div className="panel p-5">
      <div className="text-sm font-semibold mb-1">Share por tipo de empaque</div>
      <div className="text-xs text-muted-foreground mb-4">
        Peso de cada tipo de empaque en el volumen total de la categoría, y participación de {marcaPropia} dentro de cada uno.
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="h-[280px]">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="empaque" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="share" name="Share categoría" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shareMi" name={`${marcaPropia} en el empaque`} fill={MI_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="py-1.5 text-left">Empaque</th>
                <th className="py-1.5 text-right">Toneladas</th>
                <th className="py-1.5 text-right">% categoría</th>
                <th className="py-1.5 text-right">Marcas</th>
                <th className="py-1.5 text-right">Share {marcaPropia}</th>
              </tr>
            </thead>
            <tbody>
              {empaques.map((e) => (
                <tr key={e.empaque} className="border-b border-border/50">
                  <td className="py-1.5 font-medium">{e.empaque}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtNum(e.toneladas, 1)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPct(e.shareVolumen)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{e.numMarcas}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-[color:var(--color-brand)]">
                    {e.volumenMiMarca > 0 ? fmtPct(e.shareMiMarcaEnEmpaque) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalMi === 0 && (
            <div className="text-[10px] text-muted-foreground mt-2">
              {marcaPropia} no aparece en la data mapeada de empaque.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatrizTamanoEmpaque({ matrix, marcaPropia }: { matrix: SizePackagingMatrix; marcaPropia: string }) {
  if (matrix.segmentos.length === 0 || matrix.empaques.length === 0) return null;
  const maxPct = Math.max(
    ...matrix.segmentos.flatMap((s) => matrix.empaques.map((e) => matrix.cells[s]?.[e]?.pctCategoria ?? 0)),
  );
  return (
    <div className="panel p-5">
      <div className="text-sm font-semibold mb-1">Matriz Tamaño × Empaque</div>
      <div className="text-xs text-muted-foreground mb-4">
        Volumen de cada combinación como % de la categoría. Fondo más oscuro = más peso. Un ◆ dorado indica que {marcaPropia} participa en esa celda.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <th className="py-1.5 text-left sticky left-0 bg-card">Tamaño ↓ / Empaque →</th>
              {matrix.empaques.map((e) => (
                <th key={e} className="py-1.5 text-center px-2">
                  {e}
                  <div className="text-[9px] text-muted-foreground/70 normal-case font-normal">{fmtPct(matrix.pesoEmpaque[e])}</div>
                </th>
              ))}
              <th className="py-1.5 text-right px-2">Total tamaño</th>
            </tr>
          </thead>
          <tbody>
            {matrix.segmentos.map((s) => (
              <tr key={s} className="border-b border-border/50">
                <td className="py-1.5 font-medium sticky left-0 bg-card">{s}</td>
                {matrix.empaques.map((e) => {
                  const cell = matrix.cells[s]?.[e];
                  const pct = cell?.pctCategoria ?? 0;
                  const intensity = maxPct > 0 ? pct / maxPct : 0;
                  const bg = pct > 0 ? `rgba(30, 58, 138, ${Math.min(0.35, intensity * 0.4)})` : "transparent";
                  return (
                    <td key={e} className="text-center tabular-nums px-2 py-1.5" style={{ backgroundColor: bg }}>
                      {pct > 0 ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="font-semibold">{fmtPct(pct)}</span>
                          <span className="text-[9px] text-muted-foreground">{fmtNum(cell!.toneladas, 1)} t</span>
                          {cell!.miParticipa && (
                            <span className="text-[10px] text-[#facc15]" title={`${marcaPropia}: ${fmtPct(cell!.shareMiMarcaEnCelda)} de la celda`}>◆</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right tabular-nums font-semibold text-muted-foreground px-2">
                  {fmtPct(matrix.pesoSegmento[s])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
