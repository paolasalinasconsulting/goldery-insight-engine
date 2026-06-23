import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { useGoldery } from "@/lib/goldery/store";
import { analyzeSegments, brandRanking, paretoSkus } from "@/lib/goldery/calc";
import { PageHeader, Chip } from "@/components/goldery/ui";
import { FileSpreadsheet, FileText, Presentation } from "lucide-react";

export const Route = createFileRoute("/exportar")({
  head: () => ({
    meta: [
      { title: "Exportar reporte · Goldery Analyzer" },
      { name: "description", content: "Descarga el diagnóstico como Excel, PDF ejecutivo o presentación para comité." },
    ],
  }),
  component: ExportPage,
});

function ExportPage() {
  const { data, settings, categoria, periodo, cadena } = useGoldery();

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Base normalizada");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(brandRanking(data)), "Share");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paretoSkus(data)), "Pareto");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analyzeSegments(data, settings)), "Segmentos");
    XLSX.writeFile(wb, `Goldery_${categoria.replace(/\s+/g, "_")}_${periodo}.xlsx`);
  };

  const exportPDF = () => window.print();

  return (
    <>
      <PageHeader title="Exportar reporte" subtitle="Genera los entregables del diagnóstico." />
      <div className="p-8 space-y-6 max-w-4xl">
        <div className="grid lg:grid-cols-3 gap-6">
          <ExportCard
            icon={<FileSpreadsheet className="h-6 w-6" />}
            title="Excel descargable"
            body="Base normalizada + share + Pareto + segmentos como hojas separadas."
            cta="Descargar .xlsx"
            onClick={exportExcel}
          />
          <ExportCard
            icon={<FileText className="h-6 w-6" />}
            title="PDF ejecutivo"
            body="Resumen, hallazgos, gráficos y recomendación final. Usa Imprimir → Guardar como PDF."
            cta="Generar PDF"
            onClick={exportPDF}
          />
          <ExportCard
            icon={<Presentation className="h-6 w-6" />}
            title="Presentación comité"
            body="Slides: resumen, share, oportunidad por segmento, precios, claims, recomendación."
            cta="Próximamente"
            disabled
          />
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-3">Vista preliminar del reporte</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><Chip tone="neutral">Categoría</Chip> {categoria}</div>
            <div><Chip tone="neutral">Periodo</Chip> {periodo}</div>
            <div><Chip tone="neutral">Canal</Chip> {cadena}</div>
            <div><Chip tone="neutral">SKUs analizados</Chip> {data.length}</div>
            <div><Chip tone="neutral">Marcas</Chip> {new Set(data.map((d) => d.marca)).size}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function ExportCard({ icon, title, body, cta, onClick, disabled }: any) {
  return (
    <div className="panel p-5 flex flex-col gap-3">
      <div className="h-10 w-10 rounded-md bg-muted grid place-items-center text-primary">{icon}</div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground flex-1">{body}</div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="mt-2 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {cta}
      </button>
    </div>
  );
}
