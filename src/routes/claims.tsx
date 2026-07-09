import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import type { ClaimRow, TriState } from "@/lib/goldery/types";
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
  const { claims, setClaims } = useGoldery();

  const kpis = useMemo(() => {
    const tengo = claims.filter((c) => c.loTieneGoldery === "si").length;
    const meToo = claims.filter((c) => c.loUsaLider && c.loTieneGoldery === "no" && c.goldery_puede === "si").length;
    const noEntienden = claims.filter((c) => c.loTieneGoldery === "si" && c.consumidor_entiende === "no").length;
    return { tengo, meToo, noEntienden };
  }, [claims]);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Claims que tengo" value={kpis.tengo} sub={`de ${claims.length} evaluados`} tone="good" />
          <KpiCard label="Oportunidades Me-Too" value={kpis.meToo} sub="El líder los usa; yo puedo decirlos pero no los tengo" tone={kpis.meToo > 0 ? "bad" : "good"} />
          <KpiCard label="Problemas de comprensión" value={kpis.noEntienden} sub="Los tengo pero el consumidor no los entiende" tone={kpis.noEntienden > 0 ? "warn" : "good"} />
        </div>

        <InsightCard
          tone={kpis.meToo > 0 ? "bad" : "good"}
          title={kpis.meToo > 0 ? `${kpis.meToo} claim(s) requieren activación Me-Too inmediata` : "Cobertura completa de claims básicos"}
          body={kpis.meToo > 0
            ? "Cada claim que el líder usa y tú puedes decir es una oportunidad táctica antes de cualquier rediseño de portafolio."
            : "El foco de comunicación debe pasar a empaque y precio; los claims básicos ya están cubiertos."}
        />

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Claim</th>
                <th className="px-3 py-2 text-left">Marcas que lo usan</th>
                <th className="px-3 py-2 text-center">Líder</th>
                <th className="px-3 py-2 text-center">¿Lo tengo?</th>
                <th className="px-3 py-2 text-center">¿Puedo decirlo?</th>
                <th className="px-3 py-2 text-center">¿Lo entienden?</th>
                <th className="px-3 py-2 text-left">Prioridad</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c, i) => {
                const p = prioridad(c);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input value={c.claim} onChange={(e) => update(i, { claim: e.target.value })}
                        className="w-full bg-transparent font-medium focus:outline-none focus:bg-muted/40 px-1 rounded" />
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
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.accion}</td>
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
