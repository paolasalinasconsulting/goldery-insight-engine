import { createFileRoute } from "@tanstack/react-router";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader, Chip, InsightCard } from "@/components/goldery/ui";

const ITEMS = [
  "Categoría entendida en menos de 3 segundos",
  "Beneficio principal visible",
  "Claim principal más visible que el logo",
  "Variedad se entiende",
  "Tamaño se entiende",
  "Ahorro o rendimiento comunicado",
  "Usa códigos visuales de la categoría",
  "Comparable visualmente con el líder",
  "Sin exceso de información",
  "Logo no domina excesivamente el frente",
];

export const Route = createFileRoute("/empaque")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de empaque · Goldery Analyzer" },
      { name: "description", content: "Checklist de empaque por SKU con score de competitividad en percha." },
    ],
  }),
  component: PackPage,
});

function scoreOf(items: boolean[]) {
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}
function toneFor(score: number): "good" | "warn" | "bad" {
  return score >= 71 ? "good" : score >= 41 ? "warn" : "bad";
}
function labelFor(score: number) {
  return score >= 71 ? "Competitivo en percha" : score >= 41 ? "Funcional, mejorable" : "Empaque débil";
}

function PackPage() {
  const { packChecks, setPackChecks } = useGoldery();
  const toggle = (i: number, j: number) => {
    const next = packChecks.map((p, idx) => idx === i ? { ...p, items: p.items.map((v, k) => k === j ? !v : v) } : p);
    setPackChecks(next);
  };
  const addSku = () => setPackChecks([...packChecks, { sku: `SKU nuevo ${packChecks.length + 1}`, items: Array(10).fill(false) }]);

  return (
    <>
      <PageHeader title="Diagnóstico de empaque" subtitle="Checklist Me-Too: ¿el empaque compite contra el líder en góndola?" />
      <div className="p-8 space-y-6">
        <InsightCard
          tone="warn"
          title="Lectura rápida"
          body="Un empaque por debajo de 70 normalmente está comunicando mal el beneficio o desperdiciando el frente con logo. Antes de rediseñar todo, ataca los 3 ítems más bajos."
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {packChecks.map((p, i) => {
            const score = scoreOf(p.items);
            return (
              <div key={i} className="panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <input
                    value={p.sku}
                    onChange={(e) => { const next = [...packChecks]; next[i] = { ...next[i], sku: e.target.value }; setPackChecks(next); }}
                    className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:outline-none focus:border-ring px-1"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{score}</span>
                    <Chip tone={toneFor(score)}>{labelFor(score)}</Chip>
                  </div>
                </div>
                <div className="space-y-2">
                  {ITEMS.map((label, j) => (
                    <label key={j} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={p.items[j]} onChange={() => toggle(i, j)} className="mt-0.5" />
                      <span className={p.items[j] ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={addSku} className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted">
          + Agregar SKU al diagnóstico
        </button>

        <div className="panel p-5 text-sm text-muted-foreground leading-relaxed">
          <div className="text-xs uppercase tracking-[0.09em] font-semibold text-foreground mb-2">
            ¿Cómo se calcula el Silent Seller Score?
          </div>
          <p className="mb-3">
            El empaque es un vendedor silencioso: en góndola tiene menos de 3 segundos para
            comunicar categoría, beneficio y diferenciación. El score evalúa 10 criterios
            binarios (Sí / No) sobre qué tan bien el empaque cumple ese rol frente al líder.
            Cada criterio cumplido suma 10 puntos, sobre un total de 100.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 mb-1"><Chip tone="good">71 – 100</Chip><span className="font-semibold">Competitivo en percha</span></div>
              <div className="text-xs">Comunica beneficio, categoría y diferenciación. Compite visualmente contra el líder.</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 mb-1"><Chip tone="warn">41 – 70</Chip><span className="font-semibold">Funcional, mejorable</span></div>
              <div className="text-xs">Cumple lo básico pero desperdicia frente: claim débil, jerarquía confusa o códigos de categoría ausentes.</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 mb-1"><Chip tone="bad">0 – 40</Chip><span className="font-semibold">Empaque débil</span></div>
              <div className="text-xs">No vende solo. Requiere rediseño priorizando beneficio, claim principal y códigos visuales de la categoría.</div>
            </div>
          </div>
          <p className="text-xs">
            Los 10 criterios evalúan: comprensión de categoría, beneficio principal, jerarquía
            del claim vs. logo, claridad de variedad y tamaño, comunicación de ahorro o
            rendimiento, uso de códigos visuales de la categoría, comparabilidad visual con el
            líder, ausencia de exceso de información y dominancia adecuada del logo. La
            recomendación práctica: antes de rediseñar todo el empaque, ataca los 3 ítems con
            menor cumplimiento — normalmente ahí está el mayor retorno.
          </p>
        </div>
      </div>
    </>
  );
}
