import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import type { ClaimRow, TriState } from "@/lib/goldery/types";
import { claimFrequency } from "@/lib/goldery/calc";
import { PageHeader, Chip, InsightCard, KpiCard } from "@/components/goldery/ui";

export const Route = createFileRoute("/claims")({
  head: () => ({
    meta: [
      { title: "Matriz de claims · Category IQ" },
      { name: "description", content: "Claims usados por la categoría con prioridad Me-Too para la marca propia." },
    ],
  }),
  component: ClaimsPage,
});

function prioridad(c: ClaimRow): { tone: "good" | "warn" | "bad" | "neutral"; label: string; accion: string } {
  if (c.loUsaLider && c.loTieneGoldery === "no" && c.goldery_puede === "si")
    return { tone: "bad", label: "Alta", accion: "Activar Me-Too inmediato en empaque y comunicación." };
  if (c.loUsaLider && c.loTieneGoldery === "si" && c.consumidor_entiende !== "no")
    return { tone: "warn", label: "Media", accion: "Reforzar visibilidad del claim ya existente." };
  if (c.loTieneGoldery === "si" && c.consumidor_entiende === "no")
    return { tone: "bad", label: "Alta", accion: "El claim existe pero el consumidor no lo entiende — revisar copy/empaque." };
  if (!c.loUsaLider && c.goldery_puede === "si")
    return { tone: "neutral", label: "Media", accion: "Evaluar como diferenciador secundario, no como apuesta principal." };
  return { tone: "neutral", label: "Baja", accion: "No es un claim básico de la categoría." };
}

const TRI_TONE: Record<TriState, "good" | "bad" | "warn"> = { si: "good", no: "bad", duda: "warn" };
const TRI_LABEL: Record<TriState, string> = { si: "Sí", no: "No", duda: "Duda" };

function TriSelect({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  const t = TRI_TONE[value];
  const bg = t === "good" ? "chip-good" : t === "bad" ? "chip-bad" : "chip-warn";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TriState)}
      className={`${bg} text-[11px] font-semibold px-2 py-1 rounded-md border-0 cursor-pointer`}
    >
      <option value="si">Sí</option>
      <option value="no">No</option>
      <option value="duda">Duda</option>
    </select>
  );
}

function ClaimsPage() {
  const { claims, setClaims, data } = useGoldery();

  const freq = useMemo(() => claimFrequency(claims, data), [claims, data]);
  const freqByClaim = useMemo(() => {
    const m = new Map<string, typeof freq[number]>();
    freq.forEach((f) => m.set(f.claim, f));
    return m;
  }, [freq]);

  // Ordenar: brechas críticas (apuesta + no lo tengo) primero, luego apuestas, luego diferenciadores
  const orderedIdx = useMemo(() => {
    return claims
      .map((c, i) => ({ c, i, f: freqByClaim.get(c.claim) }))
      .sort((a, b) => {
        const scoreA = a.f?.brechaCritica ? 0 : a.f?.tipo === "apuesta" ? 1 : 2;
        const scoreB = b.f?.brechaCritica ? 0 : b.f?.tipo === "apuesta" ? 1 : 2;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (b.f?.numMarcas ?? 0) - (a.f?.numMarcas ?? 0);
      })
      .map((x) => x.i);
  }, [claims, freqByClaim]);

  const kpis = useMemo(() => {
    const tengo = claims.filter((c) => c.loTieneGoldery === "si").length;
    const meToo = claims.filter((c) => c.loUsaLider && c.loTieneGoldery === "no" && c.goldery_puede === "si").length;
    const noEntienden = claims.filter((c) => c.loTieneGoldery === "si" && c.consumidor_entiende === "no").length;
    const brechasCat = freq.filter((f) => f.brechaCritica).length;
    return { tengo, meToo, noEntienden, brechasCat };
  }, [claims, freq]);

  const update = (i: number, patch: Partial<ClaimRow>) => {
    const next = [...claims];
    next[i] = { ...next[i], ...patch };
    setClaims(next);
  };

  const addClaim = () => {
    setClaims([...claims, {
      id: `c${Date.now()}`, claim: "Nuevo claim", marcasUsan: "",
      loUsaLider: false, loTieneGoldery: "no", goldery_puede: "duda", consumidor_entiende: "duda",
    }]);
  };

  const remove = (i: number) => setClaims(claims.filter((_, idx) => idx !== i));

  return (
    <>
      <PageHeader
        title="Matriz de claims (Me-Too)"
        subtitle="No buscamos diferenciarnos primero: igualamos lo que el consumidor ya reconoce en los líderes."
        actions={
          <button onClick={addClaim} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium">
            + Añadir claim
          </button>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Claims que tengo" value={kpis.tengo} sub={`de ${claims.length} evaluados`} tone="good" />
          <KpiCard label="Oportunidades Me-Too" value={kpis.meToo} sub="El líder los usa; yo puedo decirlos pero no los tengo" tone={kpis.meToo > 0 ? "bad" : "good"} />
          <KpiCard label="Problemas de comprensión" value={kpis.noEntienden} sub="Los tengo pero el consumidor no los entiende" tone={kpis.noEntienden > 0 ? "warn" : "good"} />
          <KpiCard label="Brechas vs categoría" value={kpis.brechasCat} sub="Apuestas de categoría que aún no tengo" tone={kpis.brechasCat > 0 ? "bad" : "good"} />
        </div>

        <InsightCard
          tone={kpis.brechasCat > 0 ? "bad" : "good"}
          title={kpis.brechasCat > 0 ? `${kpis.brechasCat} apuesta(s) de categoría sin cubrir` : "Sin brechas críticas frente a la categoría"}
          body="Las 'apuestas de categoría' son claims comunicados por la mayoría de marcas del segmento — no tenerlos deja a Mi Marca fuera del código básico. Se ordenan primero en la tabla."
        />

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Claim</th>
                <th className="px-3 py-2 text-center">Frecuencia</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Marcas que lo usan</th>
                <th className="px-3 py-2 text-center">Líder</th>
                <th className="px-3 py-2 text-center">¿Lo tengo?</th>
                <th className="px-3 py-2 text-center">¿Puedo decirlo?</th>
                <th className="px-3 py-2 text-center">¿Lo entienden?</th>
                <th className="px-3 py-2 text-left">Prioridad</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orderedIdx.map((i) => {
                const c = claims[i];
                const p = prioridad(c);
                const f = freqByClaim.get(c.claim);
                return (
                  <tr key={c.id} className={`border-t border-border ${f?.brechaCritica ? "bg-[color:var(--color-danger)]/5" : ""}`}>
                    <td className="px-3 py-2">
                      <input value={c.claim} onChange={(e) => update(i, { claim: e.target.value })}
                        className="w-full bg-transparent font-medium focus:outline-none focus:bg-muted/40 px-1 rounded" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-sm font-bold tabular-nums">{f?.numMarcas ?? 0}</span>
                        <span className="text-[10px] text-muted-foreground">marcas</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {f?.tipo === "apuesta"
                        ? <Chip tone={f.brechaCritica ? "bad" : "warn"}>{f.brechaCritica ? "⚠ Apuesta sin cubrir" : "Apuesta de categoría"}</Chip>
                        : <Chip tone="neutral">Diferenciador</Chip>}
                    </td>
                    <td className="px-3 py-2">
                      <input value={c.marcasUsan} onChange={(e) => update(i, { marcasUsan: e.target.value })}
                        className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none focus:bg-muted/40 px-1 rounded" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={c.loUsaLider} onChange={(e) => update(i, { loUsaLider: e.target.checked })} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <TriSelect value={c.loTieneGoldery} onChange={(v) => update(i, { loTieneGoldery: v })} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.loTieneGoldery === "no"
                        ? <TriSelect value={c.goldery_puede} onChange={(v) => update(i, { goldery_puede: v })} />
                        : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.loTieneGoldery === "si"
                        ? <TriSelect value={c.consumidor_entiende} onChange={(v) => update(i, { consumidor_entiende: v })} />
                        : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2"><Chip tone={p.tone}>{p.label}</Chip></td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => remove(i)} className="text-xs text-muted-foreground hover:text-[color:var(--color-danger)]">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        <div className="text-xs text-muted-foreground">
          Leyenda: <span className="chip-good px-2 py-0.5 rounded-full">Sí</span>{" "}
          <span className="chip-bad px-2 py-0.5 rounded-full">No</span>{" "}
          <span className="chip-warn px-2 py-0.5 rounded-full">Duda</span>
          {" · "}"¿Puedo decirlo?" aplica solo cuando no tengo el claim. "¿Lo entienden?" aplica solo cuando sí lo tengo.
        </div>
      </div>
    </>
  );
}
