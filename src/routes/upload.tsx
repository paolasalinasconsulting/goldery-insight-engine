import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useGoldery } from "@/lib/goldery/store";
import { CANONICAL_FIELDS, type CanonicalField } from "@/lib/goldery/types";
import { normalizeRows } from "@/lib/goldery/calc";
import { PageHeader, Chip } from "@/components/goldery/ui";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Cargar data · Goldery Analyzer" },
      { name: "description", content: "Sube un Excel de autoservicio, mapea sus columnas y normaliza la información." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const store = useGoldery();
  const {
    categoria, periodo, cadena, pais, rawColumns, rawRows, mapping, fileName, settings,
    setRaw, setMapping, recalc, loadMock, setCategoria, setContext,
  } = store;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");

  const handleFile = async (file: File) => {
    try {
      setStatus("Leyendo archivo…");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // Prefer sheets that look like a database, else first non-empty
      const sheetName =
        wb.SheetNames.find((s) => /base|data|hoja1|sheet1/i.test(s)) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (json.length === 0) {
        setStatus(`⚠ La hoja "${sheetName}" está vacía. Hojas disponibles: ${wb.SheetNames.join(", ")}`);
        return;
      }
      const cols = Object.keys(json[0] ?? {});
      setRaw(json, cols, `${file.name} · ${sheetName}`);
      setStatus(`✓ ${json.length} filas leídas desde "${sheetName}" (${cols.length} columnas)`);
    } catch (e) {
      setStatus(`✗ Error leyendo el archivo: ${(e as Error).message}`);
    }
  };

  const requiredKeys: CanonicalField[] = ["marca", "descripcion", "tamano", "unidades"];
  const missing = requiredKeys.filter((k) => !mapping[k]);
  const allMapped = missing.length === 0;

  // Live preview: how many rows would survive normalization with current mapping
  const preview = allMapped
    ? normalizeRows(rawRows, mapping, settings, categoria)
    : [];

  const handleContinue = () => {
    recalc();
    navigate({ to: "/base" });
  };


  return (
    <>
      <PageHeader title="Subir data" subtitle="Carga el Excel de autoservicio y mapea las columnas al modelo estratégico." />
      <div className="p-8 space-y-6 max-w-6xl">
        {/* Contexto */}
        <div className="panel p-6">
          <div className="text-sm font-semibold mb-4">Contexto del análisis</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Categoría">
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {["Detergente líquido", "Ambientadores", "Desinfectantes", "Lavavajillas", "Desechables", "Otra"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Periodo"><input value={periodo} onChange={(e) => setContext({ periodo: e.target.value })} className="input" /></Field>
            <Field label="Cadena"><input value={cadena} onChange={(e) => setContext({ cadena: e.target.value })} className="input" /></Field>
            <Field label="País / ciudad"><input value={pais} onChange={(e) => setContext({ pais: e.target.value })} className="input" /></Field>
          </div>
        </div>

        {/* Upload */}
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">1. Archivo Excel</div>
            <button onClick={loadMock} className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              <PlayCircle className="h-3.5 w-3.5" /> Cargar datos de prueba
            </button>
          </div>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-ring transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Arrastra un archivo .xlsx o haz clic para seleccionar</div>
            <div className="text-xs text-muted-foreground mt-1">Acepta múltiples hojas; usamos la hoja "Base de Datos" si existe.</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
          {fileName && (
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> {fileName}
              {status && <span className="ml-2">· {status}</span>}
            </div>
          )}
        </div>

        {/* Mapping */}
        {rawColumns.length > 0 && (
          <div className="panel p-6">
            <div className="text-sm font-semibold mb-1">2. Mapeo de columnas</div>
            <div className="text-xs text-muted-foreground mb-4">
              Detectamos {rawColumns.length} columnas. Confirma o ajusta el mapeo a los campos canónicos.
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {CANONICAL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-44 text-sm">
                    {f.label}
                    {f.required && <span className="text-[color:var(--color-danger)] ml-1">*</span>}
                  </div>
                  <select
                    className="input flex-1"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                  >
                    <option value="">— ninguna —</option>
                    {rawColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {allMapped
                  ? <><CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" /> <Chip tone="good">Campos requeridos OK</Chip></>
                  : <><AlertCircle className="h-4 w-4 text-[color:var(--color-warning)]" /> <Chip tone="warn">Faltan: {missing.join(", ")}</Chip></>}
                <span className="text-muted-foreground">{rawRows.length} filas leídas</span>
                {allMapped && (
                  <span className={preview.length === 0 ? "text-[color:var(--color-danger)] font-medium" : "text-muted-foreground"}>
                    · {preview.length} filas válidas tras normalizar
                  </span>
                )}
              </div>
              {allMapped && preview.length === 0 && (
                <div className="text-xs text-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 border border-[color:var(--color-danger)]/20 rounded-md p-3">
                  Ninguna fila sobrevive la normalización. Revisa que las columnas mapeadas a <b>Marca</b>, <b>Tamaño</b> y <b>Unidades vendidas</b> realmente contengan esos datos (no encabezados, subtotales o texto).
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleContinue}
                  disabled={!allMapped}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Normalizar y continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview de columnas y primeras filas */}
        {rawColumns.length > 0 && (
          <div className="panel p-6">
            <div className="text-sm font-semibold mb-1">3. Vista previa de la hoja</div>
            <div className="text-xs text-muted-foreground mb-3">Primeras 5 filas tal como se leyeron del Excel.</div>
            <div className="overflow-x-auto">
              <table className="text-xs min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    {rawColumns.map((c) => (
                      <th key={c} className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {rawColumns.map((c) => (
                        <td key={c} className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{String(r[c] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
