import { createFileRoute } from "@tanstack/react-router";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader } from "@/components/goldery/ui";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Goldery Analyzer" },
      { name: "description", content: "Marcas propias, rangos de segmento por categoría y umbrales de la metodología." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { settings, updateSettings } = useGoldery();

  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del modelo: marcas, segmentos y umbrales." />
      <div className="p-8 space-y-6 max-w-4xl">
        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Marcas propias del grupo</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Marca foco">
              <input value={settings.marcaPropia} onChange={(e) => updateSettings({ marcaPropia: e.target.value.toUpperCase() })} className="input" />
            </Field>
            <Field label="Marcas propias (separadas por coma)">
              <input
                value={settings.marcasPropias.join(", ")}
                onChange={(e) => updateSettings({ marcasPropias: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })}
                className="input"
              />
            </Field>
            <Field label="Factor densidad (kg/L)">
              <input type="number" step={0.05} value={settings.densidad} onChange={(e) => updateSettings({ densidad: Number(e.target.value) || 1 })} className="input" />
            </Field>
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Rangos de tamaño (ml)</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left py-2">Segmento</th><th className="text-right py-2">Mín</th><th className="text-right py-2">Máx</th></tr>
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
                    <input type="number" value={s.min} onChange={(e) => {
                      const segs = [...settings.segmentos];
                      segs[i] = { ...segs[i], min: Number(e.target.value) };
                      updateSettings({ segmentos: segs });
                    }} className="input text-right tabular-nums" />
                  </td>
                  <td className="py-1.5 w-32">
                    <input type="number" value={isFinite(s.max) ? s.max : 99999} onChange={(e) => {
                      const segs = [...settings.segmentos];
                      segs[i] = { ...segs[i], max: Number(e.target.value) };
                      updateSettings({ segmentos: segs });
                    }} className="input text-right tabular-nums" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Umbrales de oportunidad</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Score mínimo · Alta">
              <input type="number" value={settings.umbralOportunidad.alta} onChange={(e) => updateSettings({ umbralOportunidad: { ...settings.umbralOportunidad, alta: Number(e.target.value) } })} className="input" />
            </Field>
            <Field label="Score mínimo · Media">
              <input type="number" value={settings.umbralOportunidad.media} onChange={(e) => updateSettings({ umbralOportunidad: { ...settings.umbralOportunidad, media: Number(e.target.value) } })} className="input" />
            </Field>
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-4">Umbrales de índice de precio</div>
          <div className="grid sm:grid-cols-4 gap-3">
            {(["muyBarato", "valor", "paridad", "sobreprecio"] as const).map((k) => (
              <Field key={k} label={k}>
                <input type="number" value={settings.umbralIndicePrecio[k]} onChange={(e) => updateSettings({ umbralIndicePrecio: { ...settings.umbralIndicePrecio, [k]: Number(e.target.value) } })} className="input" />
              </Field>
            ))}
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
