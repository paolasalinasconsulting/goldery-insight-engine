import { createFileRoute } from "@tanstack/react-router";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader, Chip, InsightCard } from "@/components/goldery/ui";

export const Route = createFileRoute("/claims")({
  head: () => ({
    meta: [
      { title: "Matriz de claims · Goldery Analyzer" },
      { name: "description", content: "Claims usados por la categoría con prioridad Me-Too para la marca propia." },
    ],
  }),
  component: ClaimsPage,
});

function priorityFor(c: { loUsaLider: boolean; loTieneGoldery: boolean; goldery_puede: boolean; consumidor_entiende: boolean }): { tone: "good" | "warn" | "bad" | "neutral"; label: string; accion: string } {
  if (c.loUsaLider && !c.loTieneGoldery && c.goldery_puede && c.consumidor_entiende)
    return { tone: "bad", label: "Alta", accion: "Activar Me-Too inmediato en empaque y comunicación." };
  if (c.loUsaLider && c.loTieneGoldery)
    return { tone: "warn", label: "Media", accion: "Reforzar visibilidad del claim ya existente." };
  if (!c.loUsaLider && c.goldery_puede && c.consumidor_entiende)
    return { tone: "neutral", label: "Media", accion: "Evaluar como diferenciador secundario, no como apuesta principal." };
  if (!c.consumidor_entiende)
    return { tone: "neutral", label: "Baja", accion: "Requiere educación al consumidor; no priorizar." };
  return { tone: "neutral", label: "Baja", accion: "No es un claim básico de la categoría." };
}

function ClaimsPage() {
  const { claims, setClaims } = useGoldery();
  const altas = claims.filter((c) => priorityFor(c).label === "Alta").length;

  const update = (i: number, patch: Partial<typeof claims[number]>) => {
    const next = [...claims];
    next[i] = { ...next[i], ...patch };
    setClaims(next);
  };

  return (
    <>
      <PageHeader title="Matriz de claims (Me-Too)" subtitle="No buscamos diferenciarnos primero: igualamos lo que el consumidor ya reconoce en los líderes." />
      <div className="p-8 space-y-6">
        <InsightCard
          tone={altas > 0 ? "bad" : "good"}
          title={`Claims con prioridad ALTA: ${altas}`}
          body={altas > 0
            ? "Hay claims que el líder comunica, que Goldery puede decir técnicamente y que actualmente no aparecen en el empaque. Cada uno es una oportunidad táctica antes de cualquier rediseño."
            : "Goldery cubre los claims básicos que usa el líder. Trabajo de claims completado; foco en empaque y precio."}
        />

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Claim</th>
                <th className="px-3 py-2 text-left">Marcas que lo usan</th>
                <th className="px-3 py-2 text-center">Líder</th>
                <th className="px-3 py-2 text-center">Goldery lo tiene</th>
                <th className="px-3 py-2 text-center">Goldery puede</th>
                <th className="px-3 py-2 text-center">Consumidor entiende</th>
                <th className="px-3 py-2 text-left">Prioridad</th>
                <th className="px-3 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c, i) => {
                const p = priorityFor(c);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{c.claim}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.marcasUsan}</td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={c.loUsaLider} onChange={(e) => update(i, { loUsaLider: e.target.checked })} /></td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={c.loTieneGoldery} onChange={(e) => update(i, { loTieneGoldery: e.target.checked })} /></td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={c.goldery_puede} onChange={(e) => update(i, { goldery_puede: e.target.checked })} /></td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={c.consumidor_entiende} onChange={(e) => update(i, { consumidor_entiende: e.target.checked })} /></td>
                    <td className="px-3 py-2"><Chip tone={p.tone}>{p.label}</Chip></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.accion}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
