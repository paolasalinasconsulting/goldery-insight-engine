import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useGoldery } from "@/lib/goldery/store";
import { CANONICAL_FIELDS, type CanonicalField } from "@/lib/goldery/types";
import { normalizeRowsReport } from "@/lib/goldery/calc";
import { PageHeader, Chip } from "@/components/goldery/ui";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, PlayCircle, Plus } from "lucide-react";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Cargar data · Category IQ" },
      { name: "description", content: "Sube un Excel de autoservicio o ingresa datos manualmente por SKU." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const store = useGoldery();
  const {
    categoria, periodo, cadena, pais, rawColumns, rawRows, mapping, fileName, settings,
    setRaw, setMapping, recalc, loadMock, setContext, agregarFilaManual, eliminarFilaManual,
  } = store;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [tab, setTab] = useState<"archivo" | "manual">("archivo");

  // formulario manual
  const [form, setForm] = useState({ marca: "", producto: "", variedad: "", tamano: "", unidades: "", pvp: "" });

  const handleFile = async (file: File) => {
    try {
      setStatus("Leyendo archivo…");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find((s) => /base|data|hoja1|sheet1/i.test(s)) ?? wb.SheetNames[0];
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

  const report = allMapped ? normalizeRowsReport(rawRows, mapping, settings, categoria) : null;

  const handleContinue = () => { recalc(); navigate({ to: "/base" }); };

  const addManual = () => {
    const unidades = Number(form.unidades);
    const pvp = Number(form.pvp);
    if (!form.marca.trim()) return alert("La marca es obligatoria");
    if (!form.tamano.trim()) return alert("El tamaño es obligatorio (ej: 1800 ml)");
    if (!unidades || unidades <= 0) return alert("Unidades vendidas debe ser mayor a 0");
    if (!pvp || pvp <= 0) return alert("El PVP es obligatorio para calcular precio/ml");
    agregarFilaManual({
      Categoria: categoria, Marca: form.marca.toUpperCase().trim(),
      Producto: form.producto || `${form.marca} ${form.tamano} ${form.variedad}`.trim(),
      Variedad: form.variedad, Tamaño: form.tamano,
      Unidades: unidades, PVP: pvp, Ventas: unidades * pvp,
      Periodo: periodo, Cadena: cadena,
    });
    setForm({ marca: "", producto: "", variedad: "", tamano: "", unidades: "", pvp: "" });
  };

  return (
    <>
      <PageHeader title="Cargar data" subtitle="Sube un Excel de autoservicio o ingresa SKUs manualmente." />
      <div className="p-8 space-y-6 max-w-6xl">
        <div className="panel p-6">
          <div className="text-sm font-semibold mb-4">Contexto del análisis</div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Categoría (usa el selector superior para cambiar)">
              <input value={categoria} readOnly className="input opacity-70 cursor-not-allowed" />
            </Field>
            <Field label="Periodo"><input value={periodo} onChange={(e) => setContext({ periodo: e.target.value })} className="input" /></Field>
            <Field label="Cadena"><input value={cadena} onChange={(e) => setContext({ cadena: e.target.value })} className="input" /></Field>
          </div>
        </div>

        <div className="panel">
          <div className="flex border-b border-border">
            <TabBtn active={tab === "archivo"} onClick={() => setTab("archivo")}>Importar archivo</TabBtn>
            <TabBtn active={tab === "manual"} onClick={() => setTab("manual")}>Entrada manual</TabBtn>
          </div>

          {tab === "archivo" && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Archivo Excel / CSV</div>
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
                <div className="text-sm font-medium">Arrastra un archivo .xlsx / .csv o haz clic para seleccionar</div>
                <div className="text-xs text-muted-foreground mt-1">Multi-hoja soportado; preferimos la hoja "Base de Datos" si existe.</div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {fileName !== "(sin datos)" && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> {fileName}
                  {status && <span className="ml-2">· {status}</span>}
                </div>
              )}
            </div>
          )}

          {tab === "manual" && (
            <div className="p-6 space-y-5">
              <div className="text-sm font-semibold">Añadir SKU manualmente</div>
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Field label="Marca *"><input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="input" placeholder="ARIEL" /></Field>
                <Field label="Producto"><input value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} className="input" placeholder="opcional" /></Field>
                <Field label="Variedad / Aroma"><input value={form.variedad} onChange={(e) => setForm({ ...form, variedad: e.target.value })} className="input" placeholder="Floral" /></Field>
                <Field label="Presentación *"><input value={form.tamano} onChange={(e) => setForm({ ...form, tamano: e.target.value })} className="input" placeholder="1800 ml" /></Field>
                <Field label="Unidades *"><input type="number" min={1} value={form.unidades} onChange={(e) => setForm({ ...form, unidades: e.target.value })} className="input" /></Field>
                <Field label="PVP *"><input type="number" min={0} step={0.01} value={form.pvp} onChange={(e) => setForm({ ...form, pvp: e.target.value })} className="input" /></Field>
              </div>
              <button onClick={addManual} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                <Plus className="h-4 w-4" /> Añadir SKU
              </button>

              {rawRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="text-left py-2">Marca</th>
                        <th className="text-left py-2">Producto</th>
                        <th className="text-left py-2">Variedad</th>
                        <th className="text-left py-2">Tamaño</th>
                        <th className="text-right py-2">Unid.</th>
                        <th className="text-right py-2">PVP</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(-10).map((r, i) => {
                        const realIdx = rawRows.length - Math.min(10, rawRows.length) + i;
                        return (
                          <tr key={realIdx} className="border-b border-border/50">
                            <td className="py-1.5">{String(r["Marca"] ?? r[mapping.marca ?? ""] ?? "")}</td>
                            <td className="py-1.5 text-muted-foreground">{String(r["Producto"] ?? r[mapping.descripcion ?? ""] ?? "")}</td>
                            <td className="py-1.5">{String(r["Variedad"] ?? r[mapping.variedad ?? ""] ?? "")}</td>
                            <td className="py-1.5">{String(r["Tamaño"] ?? r[mapping.tamano ?? ""] ?? "")}</td>
                            <td className="py-1.5 text-right tabular-nums">{String(r["Unidades"] ?? r[mapping.unidades ?? ""] ?? "")}</td>
                            <td className="py-1.5 text-right tabular-nums">{String(r["PVP"] ?? r[mapping.pvp ?? ""] ?? "")}</td>
                            <td className="py-1.5 text-right">
                              <button onClick={() => eliminarFilaManual(realIdx)} className="text-muted-foreground hover:text-[color:var(--color-danger)]">×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="text-xs text-muted-foreground mt-2">Mostrando últimas {Math.min(10, rawRows.length)} de {rawRows.length} filas.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {rawColumns.length > 0 && (
          <div className="panel p-6">
            <div className="text-sm font-semibold mb-1">Mapeo de columnas</div>
            <div className="text-xs text-muted-foreground mb-4">Detectamos {rawColumns.length} columnas. Confirma el mapeo.</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {CANONICAL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-44 text-sm">
                    {f.label}
                    {f.required && <span className="text-[color:var(--color-danger)] ml-1">*</span>}
                  </div>
                  <select className="input flex-1" value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
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
                {report && (
                  <span className={report.data.length === 0 ? "text-[color:var(--color-danger)] font-medium" : "text-muted-foreground"}>
                    · {report.data.length} filas válidas
                  </span>
                )}
                {report && report.sinPVP > 0 && <Chip tone="warn">{report.sinPVP} sin PVP</Chip>}
              </div>
              {report && report.descartadas.length > 0 && (
                <div className="text-xs bg-[color:var(--color-warning)]/10 border border-[color:var(--color-warning)]/30 rounded-md p-3">
                  <div className="font-semibold mb-1">Filas descartadas (validación amigable):</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {report.descartadas.map((d) => <li key={d.motivo}>· {d.motivo}: {d.count}</li>)}
                  </ul>
                </div>
              )}
              {report && report.data.length === 0 && (
                <div className="text-xs text-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 border border-[color:var(--color-danger)]/20 rounded-md p-3">
                  Ninguna fila sobrevive la normalización. Revisa que las columnas mapeadas a <b>Marca</b>, <b>Tamaño</b> y <b>Unidades</b> contengan datos válidos.
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleContinue} disabled={!allMapped}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Normalizar y continuar →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`.input { background: var(--color-card); border: 1px solid var(--color-input); border-radius: 6px; padding: 6px 10px; font-size: 13px; color: var(--color-foreground); width: 100%; } .input:focus { outline: none; border-color: var(--color-ring); }`}</style>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
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
