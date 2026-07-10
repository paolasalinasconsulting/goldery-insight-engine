import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { brandRanking, suggestSegments, unclassifiedBandsSuggestion, DEFAULT_VARIEDAD_DICT } from "@/lib/goldery/calc";
import { PageHeader, Chip } from "@/components/goldery/ui";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Category IQ" },
      { name: "description", content: "Marcas propias, líder manual, rangos de segmento y umbrales." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const {
    settings, updateSettings, setLiderManual, categoria, categorias, data,
    eliminarCategoria, updateVariedadDict, aplicarBandasSugeridas, reprocesarVariedades,
  } = useGoldery();
  const brands = useMemo(() => brandRanking(data), [data]);
  const uncl = useMemo(() => unclassifiedBandsSuggestion(data), [data]);
  const dictActual = settings.variedadDict?.[categoria] ?? DEFAULT_VARIEDAD_DICT[categoria] ?? [];
  const [dictTexto, setDictTexto] = useState(dictActual.join(", "));
  // sync cuando cambia la categoría
  useMemo(() => setDictTexto(dictActual.join(", ")), [categoria]);

  const aplicarSugerencia = () => {
    const nuevos = suggestSegments(data, 6);
    if (window.confirm(`Aplicar ${nuevos.length} segmentos sugeridos automáticamente? Reemplazará los actuales.`)) {
      updateSettings({ segmentos: nuevos });
    }
  };

  const guardarDict = () => {
    const terminos = dictTexto.split(",").map((s) => s.trim()).filter(Boolean);
    updateVariedadDict(categoria, terminos);
  };


  return (
    <>
      <PageHeader title="Configuración" subtitle={`Reglas del modelo para la categoría: ${categoria}`} />
      <div className="p-8 space-y-6 max-w-4xl">
        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Marca propia y líder</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Marca propia (Mi Marca)">
              <input value={settings.marcaPropia} onChange={(e) => updateSettings({ marcaPropia: e.target.value.toUpperCase() })} className="input" />
            </Field>
            <Field label="Otras marcas del grupo (coma separada)">
              <input
                value={settings.marcasPropias.join(", ")}
                onChange={(e) => updateSettings({ marcasPropias: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })}
                className="input"
              />
            </Field>
            <Field label="Marca líder (override manual)">
              <select
                value={settings.liderManual ?? ""}
                onChange={(e) => setLiderManual(e.target.value || undefined)}
                className="input"
              >
                <option value="">— Automático (top por volumen no propio) —</option>
                {brands.map((b) => <option key={b.marca} value={b.marca}>{b.marca} ({(b.shareVolumen * 100).toFixed(1)}%)</option>)}
              </select>
            </Field>
            <Field label="Factor densidad (kg/L)">
              <input type="number" step={0.05} value={settings.densidad} onChange={(e) => updateSettings({ densidad: Number(e.target.value) || 1 })} className="input" />
            </Field>
          </div>
          {settings.liderManual && (
            <div className="mt-3 text-xs"><Chip tone="info">Líder fijado manualmente: {settings.liderManual}</Chip></div>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">Agrupación de tamaños (ml)</div>
            <button onClick={aplicarSugerencia} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              Sugerir agrupación automática desde la data
            </button>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Rangos totalmente editables. Ejemplo: 900-1000-1100 ml agrupados como "~1000 ml".
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left py-2">Segmento</th><th className="text-right py-2">Mín</th><th className="text-right py-2">Máx</th><th></th></tr>
            </thead>
            <tbody>
              {settings.segmentos.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5">
                    <input value={s.label} onChange={(e) => {
                      const segs = [...settings.segmentos];
                      segs[i] = { ...segs[i], label: e.target.value };
                      updateSettings({ segmentos: segs });
                    }} className="input" />
                  </td>
                  <td className="py-1.5 w-32">
                    <input type="number" min={0} value={s.min} onChange={(e) => {
                      const segs = [...settings.segmentos];
                      segs[i] = { ...segs[i], min: Math.max(0, Number(e.target.value)) };
                      updateSettings({ segmentos: segs });
                    }} className="input text-right tabular-nums" />
                  </td>
                  <td className="py-1.5 w-32">
                    <input type="number" min={0} value={isFinite(s.max) ? s.max : 99999} onChange={(e) => {
                      const segs = [...settings.segmentos];
                      segs[i] = { ...segs[i], max: Number(e.target.value) };
                      updateSettings({ segmentos: segs });
                    }} className="input text-right tabular-nums" />
                  </td>
                  <td className="py-1.5 w-8 text-right">
                    <button onClick={() => updateSettings({ segmentos: settings.segmentos.filter((_, j) => j !== i) })}
                      className="text-muted-foreground hover:text-[color:var(--color-danger)] text-sm">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => updateSettings({ segmentos: [...settings.segmentos, { label: "Nuevo segmento", min: 0, max: 100 }] })}
            className="mt-3 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            + Añadir segmento
          </button>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Categorías registradas</div>
          <div className="space-y-2">
            {categorias.map((c) => (
              <div key={c} className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2">
                <span>{c} {c === categoria && <Chip tone="info">activa</Chip>}</span>
                {categorias.length > 1 && (
                  <button onClick={() => { if (window.confirm(`Eliminar categoría "${c}" y todos sus datos?`)) eliminarCategoria(c); }}
                    className="text-xs text-[color:var(--color-danger)]">Eliminar</button>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">Usa el selector de la esquina superior derecha para cambiar de categoría o crear una nueva.</div>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Umbrales de oportunidad (score)</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Score mínimo · Alta">
              <input type="number" value={settings.umbralOportunidad.alta} onChange={(e) => updateSettings({ umbralOportunidad: { ...settings.umbralOportunidad, alta: Number(e.target.value) } })} className="input" />
            </Field>
            <Field label="Score mínimo · Media">
              <input type="number" value={settings.umbralOportunidad.media} onChange={(e) => updateSettings({ umbralOportunidad: { ...settings.umbralOportunidad, media: Number(e.target.value) } })} className="input" />
            </Field>
          </div>
        </div>
      </div>
      <style>{`.input { background: var(--color-card); border: 1px solid var(--color-input); border-radius: 6px; padding: 6px 10px; font-size: 13px; color: var(--color-foreground); width: 100%; } .input:focus { outline: none; border-color: var(--color-ring); }`}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
