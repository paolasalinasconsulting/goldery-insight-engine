import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useGoldery } from "@/lib/goldery/store";
import {
  analyzeSegments, brandRanking, paretoSkus, priceComparisonBySegment, varietyShare,
  fairShareBySegment, fairShareByVariedad, claimFrequency,
} from "@/lib/goldery/calc";
import { PageHeader, Chip } from "@/components/goldery/ui";
import { FileSpreadsheet, FileText, Download, Save, Upload } from "lucide-react";

export const Route = createFileRoute("/exportar")({
  head: () => ({
    meta: [
      { title: "Exportar reporte · Category IQ" },
      { name: "description", content: "Descarga el diagnóstico completo o por módulo en Excel/CSV." },
    ],
  }),
  component: ExportPage,
});

function ExportPage() {
  const { data, settings, claims, categoria, periodo, cadena, exportBackup, importBackup } = useGoldery();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const stem = `CategoryIQ_${categoria.replace(/\s+/g, "_")}_${periodo}`;

  const doBackup = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CategoryIQ_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("✓ Backup descargado. Guárdalo antes de migrar a la nube.");
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = importBackup(String(reader.result ?? ""));
      setStatus(res.ok ? "✓ Backup restaurado correctamente." : `✗ Error al importar: ${res.error}`);
    };
    reader.readAsText(file);
  };

  const dl = (rows: any[], sheet: string, filename: string) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet);
    XLSX.writeFile(wb, filename);
  };
  const dlCsv = (rows: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCompleto = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "M1 Base");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(brandRanking(data)), "M2 Share marcas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(varietyShare(data)), "M2 Share variedad");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paretoSkus(data)), "M2 Pareto");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priceComparisonBySegment(data, settings)), "M3 Precios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(claims), "M4 Claims");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analyzeSegments(data, settings)), "Oportunidad");
    XLSX.writeFile(wb, `${stem}_completo.xlsx`);
  };

  const modulos = [
    {
      id: "base", titulo: "Módulo 1 · Base normalizada",
      desc: "SKUs con volumen calculado, tamaño normalizado, segmento y precio/ml.",
      rows: () => data,
    },
    {
      id: "share", titulo: "Módulo 2 · Share por marca",
      desc: "Ranking de marcas por share de VOLUMEN, con unidades y valor como referencia.",
      rows: () => brandRanking(data),
    },
    {
      id: "variedad", titulo: "Módulo 2 · Share por variedad",
      desc: "Participación por variedad/aroma y presencia de la marca propia en cada una.",
      rows: () => varietyShare(data),
    },
    {
      id: "pareto", titulo: "Módulo 2 · Pareto",
      desc: "SKUs ordenados por volumen con acumulado y bandera de Pareto 80.",
      rows: () => paretoSkus(data),
    },
    {
      id: "precios", titulo: "Módulo 3 · Precios",
      desc: "Índice de precio vs referencia por segmento con semáforo binario.",
      rows: () => priceComparisonBySegment(data, settings),
    },
    {
      id: "claims", titulo: "Módulo 4 · Claims",
      desc: "Matriz de claims con estado tri-estado y prioridad.",
      rows: () => claims,
    },
  ];

  return (
    <>
      <PageHeader title="Exportar reporte" subtitle="Descarga el diagnóstico completo o por módulo (Excel/CSV)." />
      <div className="p-8 space-y-6 max-w-5xl">
        <div className="panel p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Reporte ejecutivo completo</div>
            <div className="text-xs text-muted-foreground mt-1">Un solo Excel con los 4 módulos como hojas separadas.</div>
          </div>
          <button onClick={exportCompleto} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4" /> Descargar completo (.xlsx)
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {modulos.map((m) => (
            <div key={m.id} className="panel p-5 flex flex-col gap-3">
              <div className="text-sm font-semibold">{m.titulo}</div>
              <div className="text-xs text-muted-foreground flex-1">{m.desc}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => dl(m.rows(), m.id, `${stem}_${m.id}.xlsx`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
                <button
                  onClick={() => dlCsv(m.rows(), `${stem}_${m.id}.csv`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel p-5">
          <div className="text-sm font-semibold mb-3">Vista preliminar del análisis</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><Chip tone="neutral">Categoría</Chip> {categoria}</div>
            <div><Chip tone="neutral">Periodo</Chip> {periodo}</div>
            <div><Chip tone="neutral">Canal</Chip> {cadena}</div>
            <div><Chip tone="neutral">SKUs</Chip> {data.length}</div>
            <div><Chip tone="neutral">Marcas</Chip> {new Set(data.map((d) => d.marca)).size}</div>
            <div><Chip tone="neutral">Variedades</Chip> {new Set(data.map((d) => d.variedad)).size}</div>
          </div>
        </div>

        <button onClick={() => window.print()} className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted">
          <FileText className="h-3.5 w-3.5" /> Imprimir / Guardar como PDF
        </button>
      </div>
    </>
  );
}
