import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments } from "@/lib/goldery/calc";
import { PageHeader, Chip, fmtPct } from "@/components/goldery/ui";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/recomendacion")({
  head: () => ({
    meta: [
      { title: "Recomendación estratégica · Goldery Analyzer" },
      { name: "description", content: "Ruta estratégica final por segmento: no hacer nada, ajuste táctico o lanzar/rediseñar." },
    ],
  }),
  component: RecPage,
});

function RecPage() {
  const { data, settings, mercaditoA, mercaditoB } = useGoldery();
  const segs = useMemo(() => analyzeSegments(data, settings), [data, settings]);
  const top = segs[0];
  const deltaMerc = mercaditoB.intencion - mercaditoA.intencion;

  const rutas = {
    lanzar: segs.filter((s) => s.recomendacion === "lanzar"),
    ajuste: segs.filter((s) => s.recomendacion === "ajuste"),
    noHacer: segs.filter((s) => s.recomendacion === "no-hacer"),
  };

  return (
    <>
      <PageHeader title="Recomendación final" subtitle="Una ruta estratégica por segmento, con evidencia, riesgo y siguiente paso." />
      <div className="p-8 space-y-6">

        {top && (
          <div className="panel p-6 border-l-4 border-l-brand">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Decisión principal</div>
            <div className="text-2xl font-semibold mb-2">{rutaLabel(top.recomendacion)} · {top.segmento}</div>
            <div className="text-sm text-muted-foreground mb-4 leading-relaxed">{top.diagnostico}</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Block label="Score oportunidad" value={`${top.scoreOportunidad}/100 · ${top.nivelOportunidad}`} />
              <Block label="Peso del segmento" value={fmtPct(top.pesoCategoria)} />
              <Block label="Gap vs líder" value={fmtPct(top.gapVsLider)} />
              <Block label="Delta mercadito" value={`${deltaMerc >= 0 ? "+" : ""}${deltaMerc} pts`} />
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <RouteCard
            tone="good"
            title="Lanzar / rediseñar"
            icon={<CheckCircle2 className="h-5 w-5" />}
            count={rutas.lanzar.length}
            segs={rutas.lanzar.map((s) => s.segmento)}
            cuando="El segmento pesa, Goldery no participa o lo hace mal, y hay brecha clara con el líder."
            queHacer="Definir SKU de entrada (tamaño + precio + claim Me-Too) y validar en mercadito antes de producir."
            queNo="No entrar con un tamaño huérfano fuera del Pareto ni con precio fuera del rango competitivo."
          />
          <RouteCard
            tone="warn"
            title="Ajuste táctico"
            icon={<AlertTriangle className="h-5 w-5" />}
            count={rutas.ajuste.length}
            segs={rutas.ajuste.map((s) => s.segmento)}
            cuando="Ya participamos con precio competitivo pero share bajo: el problema es comunicación, empaque o claim."
            queHacer="Activar el claim del líder en empaque, ajustar jerarquía visual y probar precio +/- 5%."
            queNo="No rediseñar producto. No mover el precio fuera del rango de valor (85-95)."
          />
          <RouteCard
            tone="neutral"
            title="No hacer nada"
            icon={<XCircle className="h-5 w-5" />}
            count={rutas.noHacer.length}
            segs={rutas.noHacer.map((s) => s.segmento)}
            cuando="La oportunidad es baja, el segmento pesa poco, o el gap es demasiado alto para invertir."
            queHacer="Liberar recursos. Concentrar inversión en los segmentos de alta prioridad."
            queNo="No defender share marginal con descuento."
          />
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-3">Lógica central aplicada</div>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["¿En qué tamaño debo competir?", top ? `${top.segmento} (peso ${fmtPct(top.pesoCategoria)})` : "—"],
                ["¿Contra quién compito?", top?.lider ?? "—"],
                ["¿Qué precio debo tener?", top?.indicePrecio ? `Índice ${top.indicePrecio.toFixed(0)} vs líder` : "Definir vs líder del segmento"],
                ["¿Tengo oportunidad real?", top ? `${top.scoreOportunidad}/100 · ${top.nivelOportunidad}` : "—"],
                ["¿Mi problema es precio o comunicación?", top?.participaGoldery && top.indicePrecio && top.indicePrecio < 95 ? "Probablemente comunicación / empaque" : "Probablemente ausencia o precio"],
                ["¿Qué claim debo usar?", "Ver matriz Me-Too (claims usados por el líder que Goldery puede decir)"],
                ["¿Lanzo, ajusto o no hago nada?", top ? rutaLabel(top.recomendacion).toUpperCase() : "—"],
              ].map(([q, a]) => (
                <tr key={q} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground w-1/2">{q}</td>
                  <td className="px-3 py-2 font-medium">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function rutaLabel(r: "lanzar" | "ajuste" | "no-hacer") {
  return r === "lanzar" ? "Lanzar / rediseñar" : r === "ajuste" ? "Ajuste táctico" : "No hacer nada";
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  );
}

function RouteCard({ tone, title, icon, count, segs, cuando, queHacer, queNo }: {
  tone: "good" | "warn" | "neutral"; title: string; icon: React.ReactNode; count: number;
  segs: string[]; cuando: string; queHacer: string; queNo: string;
}) {
  const accent = tone === "good" ? "border-l-[color:var(--color-success)]" : tone === "warn" ? "border-l-[color:var(--color-warning)]" : "border-l-[color:var(--color-ring)]";
  return (
    <div className={`panel border-l-4 ${accent} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">{icon}{title}</div>
        <Chip tone={tone}>{count} segmento{count !== 1 ? "s" : ""}</Chip>
      </div>
      <div className="text-xs text-muted-foreground">{segs.length > 0 ? segs.join(" · ") : "—"}</div>
      <div className="space-y-2 text-sm mt-2">
        <Row label="Cuándo" body={cuando} />
        <Row label="Qué hacer" body={queHacer} />
        <Row label="Qué NO hacer" body={queNo} />
      </div>
    </div>
  );
}

function Row({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex gap-2">
      <ArrowRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
      <div className="text-sm"><span className="font-medium">{label}:</span> <span className="text-muted-foreground">{body}</span></div>
    </div>
  );
}
