import { createFileRoute } from "@tanstack/react-router";
import { useGoldery } from "@/lib/goldery/store";
import { PageHeader, KpiCard, InsightCard } from "@/components/goldery/ui";

export const Route = createFileRoute("/mercadito")({
  head: () => ({
    meta: [
      { title: "Mercadito · Goldery Analyzer" },
      { name: "description", content: "Comparativo entre empaque actual y propuesta nueva con delta de intención de compra." },
    ],
  }),
  component: MercaditoPage,
});

function MercaditoPage() {
  const { mercaditoA, mercaditoB, setMercadito } = useGoldery();

  const delta = mercaditoB.intencion - mercaditoA.intencion;
  const interpretacion = delta < 5
    ? { tone: "neutral" as const, label: "Sin diferencia significativa", body: "No hacer cambios mayores; el delta no justifica inversión en rediseño." }
    : delta < 10
    ? { tone: "warn" as const, label: "Delta moderado", body: "Justifica un ajuste táctico — claim, color o jerarquía visual — antes de un rediseño integral." }
    : { tone: "good" as const, label: "Delta significativo", body: "Validar rediseño/lanzamiento. El nuevo concepto mueve la aguja en intención de compra." };

  return (
    <>
      <PageHeader title="Mercadito" subtitle="Compara el empaque actual contra una propuesta nueva." />
      <div className="p-8 space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <Scenario title="Escenario A · Actual" data={mercaditoA} onChange={(p) => setMercadito("A", p)} />
          <Scenario title="Escenario B · Propuesta" data={mercaditoB} onChange={(p) => setMercadito("B", p)} />
        </div>

        <div className="grid lg:grid-cols-4 gap-4">
          <KpiCard label="Delta intención de compra" value={`${delta >= 0 ? "+" : ""}${delta} pts`} tone={delta >= 10 ? "good" : delta >= 5 ? "warn" : "neutral"} />
          <KpiCard label="Delta preferencia" value={`${(mercaditoB.preferencia - mercaditoA.preferencia) >= 0 ? "+" : ""}${mercaditoB.preferencia - mercaditoA.preferencia} pts`} />
          <KpiCard label="Delta calidad percibida" value={`${(mercaditoB.calidad - mercaditoA.calidad) >= 0 ? "+" : ""}${mercaditoB.calidad - mercaditoA.calidad} pts`} />
          <KpiCard label="Ventas potenciales" value={`${((delta / 100) * 100).toFixed(1)}%`} sub="incremento estimado sobre base actual" />
        </div>

        <InsightCard tone={interpretacion.tone} title={interpretacion.label} body={interpretacion.body} />
      </div>
    </>
  );
}

function Scenario({ title, data, onChange }: { title: string; data: any; onChange: (p: any) => void }) {
  const num = (k: string, label: string) => (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input
        type="number"
        value={data[k]}
        onChange={(e) => onChange({ [k]: Number(e.target.value) })}
        className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-card tabular-nums"
      />
    </label>
  );
  const text = (k: string, label: string) => (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input
        value={data[k]}
        onChange={(e) => onChange({ [k]: e.target.value })}
        className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-card"
      />
    </label>
  );
  return (
    <div className="panel p-5 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {text("sku", "SKU evaluado")}
      <div className="grid grid-cols-2 gap-3">
        {num("precio", "Precio mostrado ($)")}
        {text("claim", "Claim principal")}
        {num("intencion", "Intención compra %")}
        {num("preferencia", "Preferencia vs líder %")}
        {num("calidad", "Percepción calidad")}
        {num("ahorro", "Percepción ahorro")}
        {num("claridad", "Claridad beneficio")}
      </div>
      <label className="block">
        <div className="text-xs text-muted-foreground mb-1">Comentarios</div>
        <textarea value={data.comentarios} onChange={(e) => onChange({ comentarios: e.target.value })} rows={2} className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-card" />
      </label>
    </div>
  );
}
