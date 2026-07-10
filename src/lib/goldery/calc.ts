import type { NormalizedSku, RawRow, CanonicalField, Settings, SegmentRange } from "./types";
import { parseSize, toNumber, normalizeBrand } from "./parse";

export const DEFAULT_SEGMENTS: SegmentRange[] = [
  { label: "Pequeño (0-500 ml)", min: 0, max: 500 },
  { label: "~1000 ml", min: 501, max: 1200 },
  { label: "~1300 ml", min: 1201, max: 1500 },
  { label: "~1800 ml", min: 1501, max: 1900 },
  { label: "~2000 ml", min: 1901, max: 2200 },
  { label: "~2500 ml", min: 2201, max: 2800 },
  { label: "~3000 ml", min: 2801, max: 3400 },
  { label: "~4000 ml", min: 3401, max: 4500 },
  { label: "~5000 ml", min: 4501, max: 6000 },
  { label: "~10000 ml", min: 6001, max: Infinity },
];

/** Diccionario semilla de variedades por categoría. Editable por el usuario en Configuración. */
export const DEFAULT_VARIEDAD_DICT: Record<string, string[]> = {
  "Detergente líquido": [
    "Bicarbonato", "2 en 1", "Floral", "Flores", "Primavera", "Lavanda",
    "Ropa Bebé", "Bebé", "Sport", "Original", "Con Suavizante",
    "Cuidado y Renovación", "Frescura Intensa", "Triple Poder",
    "Malos Olores", "Toque Suavizante", "Cremoso", "Antibacterial",
  ],
};

export const DEFAULT_SETTINGS: Settings = {
  marcaPropia: "GOLDERY",
  marcasPropias: ["GOLDERY", "ANA", "ELIXIR", "REGENEXT", "BOMBA"],
  densidad: 1.0,
  segmentos: DEFAULT_SEGMENTS,
  liderManual: undefined,
  comparacionesPrecio: {},
  umbralOportunidad: { alta: 75, media: 50 },
  umbralIndicePrecio: { muyBarato: 85, valor: 95, paridad: 105, sobreprecio: 115 },
  variedadDict: DEFAULT_VARIEDAD_DICT,
};

export function segmentOf(ml: number, segs: SegmentRange[]): string {
  return segs.find((s) => ml >= s.min && ml <= s.max)?.label ?? "Sin clasificar";
}

/** Normaliza texto: minúsculas + sin acentos, para matching robusto. */
function normText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Extrae la variedad más específica (texto más largo) del diccionario que aparezca en el texto. */
export function extractVariedadFromText(text: string, dict: string[]): string {
  if (!text || !dict || dict.length === 0) return "";
  const t = normText(text);
  if (!t) return "";
  const sorted = [...dict].sort((a, b) => b.length - a.length);
  for (const v of sorted) {
    const n = normText(v);
    if (!n) continue;
    if (t.includes(n)) return v;
  }
  return "";
}


export interface NormalizeReport {
  data: NormalizedSku[];
  descartadas: { motivo: string; count: number }[];
  sinPVP: number;
}

export interface NormalizeOptions {
  /** Diccionario para extraer variedad desde la descripción cuando la columna no aporta. */
  variedadDict?: string[];
  /** Overrides manuales de variedad, keyed por descripción normalizada del SKU. */
  variedadOverrides?: Record<string, string>;
}

/** Placeholders que consideramos "vacío" en el campo variedad (mayúscula/minúscula, con % opcional). */
function esVariedadVacia(v: string): boolean {
  const n = normText(v);
  if (!n) return true;
  return /^sin variedad(\s*\d+(\.\d+)?\s*%?)?$/.test(n) || n === "n/a" || n === "na" || n === "-";
}

/** Clave normalizada usada para asociar overrides de variedad al SKU (por descripción). */
export function overrideKey(descripcion: string): string {
  return normText(descripcion);
}

export function normalizeRowsReport(
  rows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
  settings: Settings,
  categoria: string,
  opts: NormalizeOptions = {},
): NormalizeReport {
  const out: NormalizedSku[] = [];
  let sinMarca = 0, tamCero = 0, unidNoPos = 0, sinPVP = 0;
  const dict = opts.variedadDict ?? settings.variedadDict?.[categoria] ?? [];
  const overrides = opts.variedadOverrides ?? {};
  rows.forEach((r, i) => {
    const get = (k: CanonicalField) => (mapping[k] ? r[mapping[k]!] : undefined);
    const tam = parseSize(get("tamano"));
    const unidades = toNumber(get("unidades"));
    const pvp = toNumber(get("pvp"));
    const marca = normalizeBrand(get("marca"));
    if (!marca) { sinMarca++; return; }
    if (tam.ml <= 0) { tamCero++; return; }
    if (unidades <= 0) { unidNoPos++; return; }
    if (pvp <= 0) sinPVP++;
    const volumenMl = unidades * tam.ml;
    const volumenL = volumenMl / 1000;
    const ventasValor = toNumber(get("ventasValor")) || unidades * pvp;
    const descripcion = String(get("descripcion") ?? "").trim();
    // ---- Variedad: (1) override manual, (2) columna si trae valor útil, (3) extracción del texto, (4) "Por clasificar"
    let variedad = "";
    const ovr = overrides[overrideKey(descripcion)];
    if (ovr && ovr.trim()) {
      variedad = ovr.trim();
    } else {
      const raw = String(get("variedad") ?? "").trim();
      if (raw && !esVariedadVacia(raw)) {
        variedad = raw;
      } else {
        const extraida = extractVariedadFromText(descripcion, dict);
        variedad = extraida || "Por clasificar";
      }
    }
    out.push({
      id: `row-${i}`,
      categoria: String(get("categoria") ?? categoria ?? "").trim() || categoria,
      marca,
      descripcion,
      variedad,
      empaque: String(get("empaque") ?? "").trim(),
      tamanoMl: tam.ml,
      unidad: tam.unidad,
      unidades,
      pvp,
      ventasValor,
      volumenMl,
      volumenL,
      toneladas: (volumenL * settings.densidad) / 1000,
      precioPorMl: tam.ml > 0 ? pvp / tam.ml : 0,
      segmento: segmentOf(tam.ml, settings.segmentos),
      esGoldery: settings.marcasPropias.includes(marca) || marca === settings.marcaPropia,
    });
  });
  const descartadas = [
    { motivo: "Sin marca", count: sinMarca },
    { motivo: "Tamaño no legible", count: tamCero },
    { motivo: "Unidades ≤ 0", count: unidNoPos },
  ].filter((d) => d.count > 0);
  return { data: out, descartadas, sinPVP };
}

export function normalizeRows(
  rows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
  settings: Settings,
  categoria: string,
  opts: NormalizeOptions = {},
): NormalizedSku[] {
  return normalizeRowsReport(rows, mapping, settings, categoria, opts).data;
}


export interface BrandAgg {
  marca: string;
  volumenMl: number;
  toneladas: number;
  unidades: number;
  ventasValor: number;
  shareVolumen: number;
  shareUnidades: number;
  shareValor: number;
  rank: number;
  esGoldery: boolean;
}

export function brandRanking(data: NormalizedSku[]): BrandAgg[] {
  const totalVol = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const totalU = data.reduce((s, r) => s + r.unidades, 0) || 1;
  const totalV = data.reduce((s, r) => s + r.ventasValor, 0) || 1;
  const map = new Map<string, BrandAgg>();
  for (const r of data) {
    const cur = map.get(r.marca) ?? {
      marca: r.marca, volumenMl: 0, toneladas: 0, unidades: 0, ventasValor: 0,
      shareVolumen: 0, shareUnidades: 0, shareValor: 0, rank: 0, esGoldery: r.esGoldery,
    };
    cur.volumenMl += r.volumenMl;
    cur.toneladas += r.toneladas;
    cur.unidades += r.unidades;
    cur.ventasValor += r.ventasValor;
    map.set(r.marca, cur);
  }
  const arr = [...map.values()].map((b) => ({
    ...b,
    shareVolumen: b.volumenMl / totalVol,
    shareUnidades: b.unidades / totalU,
    shareValor: b.ventasValor / totalV,
  }));
  arr.sort((a, b) => b.volumenMl - a.volumenMl);
  arr.forEach((b, i) => (b.rank = i + 1));
  return arr;
}

/** Determina el líder de la categoría: manual si está definido, si no el top por volumen. */
export function categoryLeader(data: NormalizedSku[], settings: Settings): string {
  const brands = brandRanking(data);
  if (settings.liderManual && brands.some((b) => b.marca === settings.liderManual)) {
    return settings.liderManual;
  }
  const primerNoPropio = brands.find((b) => !b.esGoldery);
  return primerNoPropio?.marca ?? brands[0]?.marca ?? "";
}

export interface ParetoSku extends NormalizedSku {
  shareVolumen: number;
  acumulado: number;
  enPareto80: boolean;
}

export function paretoSkus(data: NormalizedSku[]): ParetoSku[] {
  const total = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const sorted = [...data].sort((a, b) => b.volumenMl - a.volumenMl);
  let acc = 0;
  return sorted.map((r) => {
    const share = r.volumenMl / total;
    acc += share;
    return { ...r, shareVolumen: share, acumulado: acc, enPareto80: acc <= 0.8 };
  });
}

/** Share por segmento × marca (para gráfico de barras apiladas). */
export interface SegmentShareStack {
  segmento: string;
  volumenTotal: number;
  marcas: Record<string, number>; // marca -> share dentro del segmento (0-1)
  volumenPorMarca: Record<string, number>;
}
export function segmentBrandShare(data: NormalizedSku[], settings: Settings): SegmentShareStack[] {
  const out: SegmentShareStack[] = [];
  for (const seg of settings.segmentos) {
    const rows = data.filter((r) => r.segmento === seg.label);
    if (rows.length === 0) continue;
    const total = rows.reduce((s, r) => s + r.volumenMl, 0) || 1;
    const marcas: Record<string, number> = {};
    const volumenPorMarca: Record<string, number> = {};
    for (const r of rows) {
      volumenPorMarca[r.marca] = (volumenPorMarca[r.marca] ?? 0) + r.volumenMl;
    }
    Object.entries(volumenPorMarca).forEach(([m, v]) => (marcas[m] = v / total));
    out.push({ segmento: seg.label, volumenTotal: total, marcas, volumenPorMarca });
  }
  return out;
}

/** Share por Variedad / Aroma (todas las marcas). */
export interface VarietyShare {
  variedad: string;
  volumenMl: number;
  shareVolumen: number;
  volumenGoldery: number;
  shareGolderyEnVariedad: number;
}
export function varietyShare(data: NormalizedSku[]): VarietyShare[] {
  const total = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const map = new Map<string, { vol: number; volG: number }>();
  for (const r of data) {
    const k = r.variedad || "Sin variedad";
    const cur = map.get(k) ?? { vol: 0, volG: 0 };
    cur.vol += r.volumenMl;
    if (r.esGoldery) cur.volG += r.volumenMl;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([variedad, v]) => ({
      variedad,
      volumenMl: v.vol,
      shareVolumen: v.vol / total,
      volumenGoldery: v.volG,
      shareGolderyEnVariedad: v.vol > 0 ? v.volG / v.vol : 0,
    }))
    .sort((a, b) => b.volumenMl - a.volumenMl);
}

/** Matriz de precio/ml por segmento × marca, independiente del share. */
export interface PriceRow {
  segmento: string;
  marca: string;
  precioMlPromedio: number;
  volumenMl: number;
  unidades: number;
  esGoldery: boolean;
}
export function priceMatrix(data: NormalizedSku[]): PriceRow[] {
  const map = new Map<string, PriceRow & { _sumValor: number }>();
  for (const r of data) {
    if (r.tamanoMl <= 0 || r.pvp <= 0) continue;
    const k = `${r.segmento}||${r.marca}`;
    const cur = map.get(k) ?? {
      segmento: r.segmento, marca: r.marca,
      precioMlPromedio: 0, volumenMl: 0, unidades: 0,
      esGoldery: r.esGoldery, _sumValor: 0,
    };
    // precio/ml ponderado por volumen: sum(pvp*unidades) / sum(volumenMl)
    cur._sumValor += r.pvp * r.unidades;
    cur.volumenMl += r.volumenMl;
    cur.unidades += r.unidades;
    map.set(k, cur);
  }
  const out: PriceRow[] = [];
  for (const v of map.values()) {
    out.push({
      segmento: v.segmento,
      marca: v.marca,
      precioMlPromedio: v.volumenMl > 0 ? v._sumValor / v.volumenMl : 0,
      volumenMl: v.volumenMl,
      unidades: v.unidades,
      esGoldery: v.esGoldery,
    });
  }
  return out;
}

export interface PriceComparison {
  segmento: string;
  marcaComparada: string;      // marca contra la que se compara
  precioMlComparado: number;
  precioMlMiMarca: number;
  indice: number;              // (miMarca / comparada) * 100; 0 si sin presencia
  miMarcaPresente: boolean;
  volumenSegmento: number;
  volumenMiMarca: number;      // volumen de mi marca dentro del segmento (para ponderar)
  semaforo: "verde" | "rojo" | "gris";
}
export function priceComparisonBySegment(
  data: NormalizedSku[],
  settings: Settings,
): PriceComparison[] {
  const matrix = priceMatrix(data);
  const liderCat = categoryLeader(data, settings);
  const out: PriceComparison[] = [];
  for (const seg of settings.segmentos) {
    const rows = matrix.filter((r) => r.segmento === seg.label);
    if (rows.length === 0) continue;
    const marcasEnSeg = rows.slice().sort((a, b) => b.volumenMl - a.volumenMl);
    // Referencia: (1) override manual por segmento, (2) líder de categoría si compite en el segmento,
    // (3) mayor volumen no-propia, (4) mayor volumen del segmento.
    let elegida = settings.comparacionesPrecio[seg.label];
    if (!elegida || !marcasEnSeg.some((m) => m.marca === elegida)) {
      if (liderCat && marcasEnSeg.some((m) => m.marca === liderCat)) {
        elegida = liderCat;
      } else {
        elegida = marcasEnSeg.find((m) => !m.esGoldery)?.marca ?? marcasEnSeg[0].marca;
      }
    }
    const comparada = rows.find((r) => r.marca === elegida)!;
    // Consolidar TODAS las filas esGoldery (por si hay varias marcasPropias) en un único "mi"
    const misRows = rows.filter((r) => r.esGoldery && r.marca !== elegida);
    const miVol = misRows.reduce((s, r) => s + r.volumenMl, 0);
    const miValor = misRows.reduce((s, r) => s + r.precioMlPromedio * r.volumenMl, 0);
    const miPrecioMl = miVol > 0 ? miValor / miVol : 0;
    const miPresente = misRows.length > 0 && miVol > 0;
    const volSeg = rows.reduce((s, r) => s + r.volumenMl, 0);
    const indice = miPresente && comparada.precioMlPromedio > 0
      ? (miPrecioMl / comparada.precioMlPromedio) * 100
      : 0;
    out.push({
      segmento: seg.label,
      marcaComparada: elegida,
      precioMlComparado: comparada.precioMlPromedio,
      precioMlMiMarca: miPrecioMl,
      indice,
      miMarcaPresente: miPresente,
      volumenSegmento: volSeg,
      volumenMiMarca: miVol,
      semaforo: !miPresente ? "gris" : indice < 100 ? "verde" : "rojo",
    });
  }
  return out;
}

export interface SegmentAnalysis {
  segmento: string;
  volumenMl: number;
  pesoCategoria: number;
  lider: string;
  volumenLider: number;
  shareLider: number;
  volumenGoldery: number;
  shareGolderyEnSegmento: number;
  gapVsLider: number;
  precioMlLider: number;
  precioMlGoldery: number;
  indicePrecio: number;
  participaGoldery: boolean;
  scoreOportunidad: number;
  nivelOportunidad: "Alta" | "Media" | "Baja";
  diagnostico: string;
  recomendacion: "no-hacer" | "ajuste" | "lanzar";
}

export function analyzeSegments(data: NormalizedSku[], settings: Settings): SegmentAnalysis[] {
  const totalCat = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const liderCategoria = categoryLeader(data, settings);
  const out: SegmentAnalysis[] = [];
  for (const seg of settings.segmentos) {
    const rows = data.filter((r) => r.segmento === seg.label);
    if (rows.length === 0) continue;
    const volumenMl = rows.reduce((s, r) => s + r.volumenMl, 0);
    const pesoCategoria = volumenMl / totalCat;

    const byBrand = new Map<string, { vol: number; sumPvp: number; unidades: number; esGoldery: boolean }>();
    for (const r of rows) {
      const cur = byBrand.get(r.marca) ?? { vol: 0, sumPvp: 0, unidades: 0, esGoldery: r.esGoldery };
      cur.vol += r.volumenMl;
      cur.sumPvp += r.precioPorMl * r.unidades;
      cur.unidades += r.unidades;
      byBrand.set(r.marca, cur);
    }
    const brands = [...byBrand.entries()]
      .map(([marca, v]) => ({
        marca, vol: v.vol,
        precioMl: v.unidades > 0 ? v.sumPvp / v.unidades : 0,
        esGoldery: v.esGoldery,
      }))
      .sort((a, b) => b.vol - a.vol);
    const lider = brands.find((b) => b.marca === liderCategoria) ?? brands[0];

    const goldery = brands.find((b) => b.esGoldery);
    const participa = !!goldery;
    const volumenGoldery = goldery?.vol ?? 0;
    const shareGolderyEnSegmento = volumenGoldery / volumenMl;
    const gapVsLider = (lider.vol - volumenGoldery) / volumenMl;
    const indicePrecio = goldery && lider.precioMl > 0
      ? (goldery.precioMl / lider.precioMl) * 100
      : 0;

    const pesoPts = Math.min(pesoCategoria * 100, 40);
    const ausenciaPts = participa ? Math.max(0, 25 - shareGolderyEnSegmento * 100) : 25;
    const liderConc = (lider.vol / volumenMl) * 15;
    const precioPts = indicePrecio === 0 ? 7 : indicePrecio < 105 ? 10 : indicePrecio < 115 ? 6 : 3;
    const factibilidad = participa ? 8 : 6;
    const score = Math.round(pesoPts + ausenciaPts + liderConc + precioPts + factibilidad);

    const nivel = score >= settings.umbralOportunidad.alta ? "Alta"
      : score >= settings.umbralOportunidad.media ? "Media" : "Baja";

    let diagnostico = "";
    let recomendacion: SegmentAnalysis["recomendacion"] = "no-hacer";
    if (!participa && pesoCategoria > 0.1) {
      diagnostico = `${settings.marcaPropia} no participa en un segmento que concentra el ${(pesoCategoria * 100).toFixed(1)}% de la categoría. Líder ${lider.marca} domina con ${((lider.vol / volumenMl) * 100).toFixed(0)}%.`;
      recomendacion = nivel === "Baja" ? "no-hacer" : "lanzar";
    } else if (participa && indicePrecio > 0 && indicePrecio < 95 && shareGolderyEnSegmento < 0.1) {
      diagnostico = `${settings.marcaPropia} compite con ventaja de precio (índice ${indicePrecio.toFixed(0)}) frente a ${lider.marca}, pero el bajo share (${(shareGolderyEnSegmento * 100).toFixed(1)}%) sugiere problema de comunicación, empaque o credibilidad.`;
      recomendacion = "ajuste";
    } else if (participa && indicePrecio > 115) {
      diagnostico = `${settings.marcaPropia} está sobreindexada en precio (índice ${indicePrecio.toFixed(0)}); riesgo de baja conversión vs ${lider.marca}.`;
      recomendacion = "ajuste";
    } else if (participa && shareGolderyEnSegmento > 0.15) {
      diagnostico = `${settings.marcaPropia} tiene posición sólida (${(shareGolderyEnSegmento * 100).toFixed(1)}% del segmento). Mantener y proteger.`;
      recomendacion = "no-hacer";
    } else if (!participa) {
      diagnostico = `Segmento marginal (${(pesoCategoria * 100).toFixed(1)}%); la inversión no se justifica.`;
      recomendacion = "no-hacer";
    } else {
      diagnostico = `Participación moderada con ${lider.marca} liderando. Evaluar ajuste de precio o claim.`;
      recomendacion = nivel === "Alta" ? "lanzar" : "ajuste";
    }

    out.push({
      segmento: seg.label,
      volumenMl,
      pesoCategoria,
      lider: lider.marca,
      volumenLider: lider.vol,
      shareLider: lider.vol / volumenMl,
      volumenGoldery,
      shareGolderyEnSegmento,
      gapVsLider,
      precioMlLider: lider.precioMl,
      precioMlGoldery: goldery?.precioMl ?? 0,
      indicePrecio,
      participaGoldery: participa,
      scoreOportunidad: score,
      nivelOportunidad: nivel,
      diagnostico,
      recomendacion,
    });
  }
  return out.sort((a, b) => b.scoreOportunidad - a.scoreOportunidad);
}

export function priceDiagnosis(indice: number, umbral: Settings["umbralIndicePrecio"]): {
  level: "muy-barato" | "valor" | "paridad" | "moderado" | "alto";
  label: string;
  tone: "good" | "warn" | "bad";
} {
  if (indice === 0) return { level: "paridad", label: "Sin presencia", tone: "warn" };
  if (indice < umbral.muyBarato) return { level: "muy-barato", label: "Demasiado barato", tone: "bad" };
  if (indice < umbral.valor) return { level: "valor", label: "Ventaja de valor", tone: "good" };
  if (indice < umbral.paridad) return { level: "paridad", label: "Paridad con líder", tone: "good" };
  if (indice < umbral.sobreprecio) return { level: "moderado", label: "Sobreprecio moderado", tone: "warn" };
  return { level: "alto", label: "Sobreprecio alto", tone: "bad" };
}

/** Clustering 1D simple sobre tamaños reales — sugiere agrupación automática. */
export function suggestSegments(data: NormalizedSku[], k = 6): SegmentRange[] {
  const sizes = data.map((r) => r.tamanoMl).filter((s) => s > 0).sort((a, b) => a - b);
  if (sizes.length === 0) return DEFAULT_SEGMENTS;
  const uniq = Array.from(new Set(sizes));
  const buckets = Math.min(k, uniq.length);
  // partición equifrecuente
  const out: SegmentRange[] = [];
  const step = Math.floor(sizes.length / buckets);
  let prevMax = 0;
  for (let i = 0; i < buckets; i++) {
    const startIdx = i * step;
    const endIdx = i === buckets - 1 ? sizes.length - 1 : (i + 1) * step - 1;
    const slice = sizes.slice(startIdx, endIdx + 1);
    const min = prevMax + 1;
    const max = i === buckets - 1 ? Infinity : slice[slice.length - 1];
    const centro = Math.round(slice[Math.floor(slice.length / 2)]);
    out.push({
      label: max === Infinity ? `${centro}+ ml` : `~${centro} ml`,
      min: i === 0 ? 0 : min,
      max,
    });
    prevMax = max;
  }
  return out;
}

/* ============================================================
 * Fair Share (estilo NielsenIQ/Circana)
 * Compara el share total de Mi Marca en la categoría contra su share
 * dentro de cada Agrupación de Tamaño y cada Variedad.
 * ============================================================ */
export interface FairShareRow {
  segmento: string;                 // nombre del segmento o variedad
  volumenSegmento: number;
  volumenMiMarca: number;
  shareEnSegmento: number;          // 0-1
  shareReferencia: number;          // 0-1 (share total de mi marca)
  gapPts: number;                   // (shareEnSegmento - shareReferencia) * 100
  indicador: "sobre" | "sub" | "neutral";
  pesoSegmento: number;             // 0-1, peso del segmento en la categoría
}

function fairShareGeneric(
  data: NormalizedSku[],
  key: (r: NormalizedSku) => string,
): FairShareRow[] {
  const totalCat = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const totalMi = data.filter((r) => r.esGoldery).reduce((s, r) => s + r.volumenMl, 0);
  const shareRef = totalMi / totalCat;
  const map = new Map<string, { vol: number; volMi: number }>();
  for (const r of data) {
    const k = key(r) || "Sin clasificar";
    const cur = map.get(k) ?? { vol: 0, volMi: 0 };
    cur.vol += r.volumenMl;
    if (r.esGoldery) cur.volMi += r.volumenMl;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([segmento, v]) => {
      const shareEn = v.vol > 0 ? v.volMi / v.vol : 0;
      const gapPts = (shareEn - shareRef) * 100;
      return {
        segmento,
        volumenSegmento: v.vol,
        volumenMiMarca: v.volMi,
        shareEnSegmento: shareEn,
        shareReferencia: shareRef,
        gapPts,
        indicador: gapPts > 1 ? "sobre" : gapPts < -1 ? "sub" : "neutral",
        pesoSegmento: v.vol / totalCat,
      } as FairShareRow;
    })
    .sort((a, b) => b.pesoSegmento - a.pesoSegmento);
}

export function fairShareBySegment(data: NormalizedSku[]): FairShareRow[] {
  return fairShareGeneric(data, (r) => r.segmento);
}
export function fairShareByVariedad(data: NormalizedSku[]): FairShareRow[] {
  return fairShareGeneric(data, (r) => r.variedad || "Sin variedad");
}

/* ============================================================
 * Frecuencia de claims (estilo Mintel)
 * Cuenta cuántas marcas de la categoría comunican cada claim y
 * clasifica: "Apuesta de categoría" (>=50% de las marcas top) vs
 * "Diferenciador" (pocos).
 * ============================================================ */
export interface ClaimFrequency {
  claim: string;
  numMarcas: number;
  marcas: string[];
  penetracion: number;             // numMarcas / marcasEnCategoria
  tipo: "apuesta" | "diferenciador";
  brechaCritica: boolean;          // apuesta + Mi Marca no lo tiene
}

export function claimFrequency(
  claims: { claim: string; marcasUsan: string; loTieneGoldery: string }[],
  data: NormalizedSku[],
): ClaimFrequency[] {
  const marcasCategoria = new Set(data.map((r) => r.marca));
  const totalMarcas = Math.max(marcasCategoria.size, 3);
  return claims.map((c) => {
    const marcas = (c.marcasUsan || "")
      .split(/[,;\/]/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);
    const uniq = Array.from(new Set(marcas));
    const penetracion = uniq.length / totalMarcas;
    const tipo: ClaimFrequency["tipo"] =
      uniq.length >= 3 || penetracion >= 0.4 ? "apuesta" : "diferenciador";
    return {
      claim: c.claim,
      numMarcas: uniq.length,
      marcas: uniq,
      penetracion,
      tipo,
      brechaCritica: tipo === "apuesta" && c.loTieneGoldery !== "si",
    };
  });
}

/* ============================================================
 * Snapshot para histórico de precios.
 * Devuelve una foto plana (segmento, marcaRef, indice, precioMi, precioRef).
 * ============================================================ */
export interface PriceSnapshot {
  fecha: string;                    // ISO
  segmento: string;
  marcaRef: string;
  indice: number;
  precioMlMi: number;
  precioMlRef: number;
  miPresente: boolean;
}
export function buildPriceSnapshot(data: NormalizedSku[], settings: Settings): PriceSnapshot[] {
  const fecha = new Date().toISOString();
  return priceComparisonBySegment(data, settings).map((c) => ({
    fecha,
    segmento: c.segmento,
    marcaRef: c.marcaComparada,
    indice: c.indice,
    precioMlMi: c.precioMlMiMarca,
    precioMlRef: c.precioMlComparado,
    miPresente: c.miMarcaPresente,
  }));
}

/* ============================================================
 * Resumen ejecutivo por categoría — usado por dashboard integrado.
 * ============================================================ */
export interface CategorySummary {
  share: number;                    // 0-1 share volumen mi marca
  ranking: number;
  numMarcas: number;
  indicePrecioPromedio: number;     // ponderado por volumen de MI marca en cada segmento
  segmentosMasBarato: number;       // #segmentos con índice < 100
  segmentosTotal: number;
  claimsCubiertos: number;          // 0-1
  claimsTotal: number;
  claimsTengo: number;
  tieneData: boolean;
  indiceDetalle: Array<{ segmento: string; marcaRef: string; indice: number; volumenMi: number }>;
}
export function categorySummary(
  data: NormalizedSku[],
  settings: Settings,
  claims: { loTieneGoldery: string }[],
): CategorySummary {
  const brands = brandRanking(data);
  const mi = brands.find((b) => b.marca === settings.marcaPropia) ?? brands.find((b) => b.esGoldery);
  const comps = priceComparisonBySegment(data, settings);
  const compsMi = comps.filter((c) => c.miMarcaPresente && c.indice > 0 && c.volumenMiMarca > 0);
  const wTot = compsMi.reduce((s, c) => s + c.volumenMiMarca, 0) || 1;
  const idxProm = compsMi.reduce((s, c) => s + c.indice * c.volumenMiMarca, 0) / wTot;
  const barato = comps.filter((c) => c.semaforo === "verde").length;
  const claimsTengo = claims.filter((c) => c.loTieneGoldery === "si").length;
  return {
    share: mi?.shareVolumen ?? 0,
    ranking: mi?.rank ?? 0,
    numMarcas: brands.length,
    indicePrecioPromedio: compsMi.length ? idxProm : 0,
    segmentosMasBarato: barato,
    segmentosTotal: comps.length,
    claimsCubiertos: claims.length ? claimsTengo / claims.length : 0,
    claimsTotal: claims.length,
    claimsTengo,
    tieneData: data.length > 0,
    indiceDetalle: compsMi.map((c) => ({
      segmento: c.segmento, marcaRef: c.marcaComparada, indice: c.indice, volumenMi: c.volumenMiMarca,
    })),
  };
}

/* ============================================================
 * Data-quality helpers: detección de mapeo dudoso y duplicados.
 * ============================================================ */
export const PACKAGING_KEYWORDS = [
  "doypack","doy pack","botella","sachet","galon","galón","pouch","bolsa","frasco","caja","tarro","lata","spray","pote","stand up","standup",
];

export function detectVariedadLooksLikeEmpaque(
  rows: RawRow[],
  variedadCol: string | undefined,
): { total: number; sospechosos: number; ejemplos: string[] } {
  if (!variedadCol) return { total: 0, sospechosos: 0, ejemplos: [] };
  const kw = PACKAGING_KEYWORDS;
  let sospechosos = 0;
  const set = new Set<string>();
  for (const r of rows) {
    const v = String(r[variedadCol] ?? "").toLowerCase().trim();
    if (!v) continue;
    if (kw.some((k) => v.includes(k))) {
      sospechosos++;
      if (set.size < 5) set.add(String(r[variedadCol]));
    }
  }
  return { total: rows.length, sospechosos, ejemplos: [...set] };
}

export function findDuplicateMappingTargets(
  mapping: Partial<Record<CanonicalField, string>>,
): { col: string; targets: CanonicalField[] }[] {
  const inv = new Map<string, CanonicalField[]>();
  for (const [k, v] of Object.entries(mapping) as [CanonicalField, string | undefined][]) {
    if (!v) continue;
    const arr = inv.get(v) ?? [];
    arr.push(k);
    inv.set(v, arr);
  }
  return [...inv.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([col, targets]) => ({ col, targets }));
}

export interface DuplicateGroup {
  key: string;
  marca: string;
  variedad: string;
  empaque: string;
  tamano: string;
  indices: number[];
  unidadesTotal: number;
}

export function detectDuplicateRows(
  rows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
): DuplicateGroup[] {
  const get = (r: RawRow, k: CanonicalField) => (mapping[k] ? String(r[mapping[k]!] ?? "").trim().toLowerCase() : "");
  const groups = new Map<string, DuplicateGroup>();
  rows.forEach((r, i) => {
    const marca = get(r, "marca");
    const variedad = get(r, "variedad");
    const empaque = get(r, "empaque");
    const tamano = get(r, "tamano");
    if (!marca || !tamano) return;
    const key = [marca, variedad, empaque, tamano].join("|");
    const cur = groups.get(key) ?? {
      key,
      marca: String(mapping.marca ? r[mapping.marca] : "") || marca.toUpperCase(),
      variedad: String(mapping.variedad ? r[mapping.variedad] : "") || "",
      empaque: String(mapping.empaque ? r[mapping.empaque] : "") || "",
      tamano: String(mapping.tamano ? r[mapping.tamano] : "") || "",
      indices: [],
      unidadesTotal: 0,
    };
    cur.indices.push(i);
    cur.unidadesTotal += Number(mapping.unidades ? r[mapping.unidades] : 0) || 0;
    groups.set(key, cur);
  });
  return [...groups.values()].filter((g) => g.indices.length > 1);
}

/* ============================================================
 * Pareto — análisis de brecha de portafolio vs. conversión.
 * ============================================================ */
export interface ParetoBrandDiagnosis {
  golderyEn80: number;
  segmentosPareto80: string[];
  segmentosGoldery: string[];
  segmentosCompartidos: string[];
  caso: "sin-goldery" | "brecha-portafolio" | "brecha-conversion" | "ok";
  mensaje: string;
}

export function paretoBrandDiagnosis(
  pareto: (NormalizedSku & { enPareto80: boolean; shareVolumen: number })[],
  data: NormalizedSku[],
  marcaPropia: string,
): ParetoBrandDiagnosis {
  const en80 = pareto.filter((p) => p.enPareto80);
  const golderyEn80 = en80.filter((p) => p.esGoldery).length;
  const segmentosPareto80 = Array.from(new Set(en80.map((p) => p.segmento))).filter((s) => s && s !== "Sin clasificar");
  const segmentosGoldery = Array.from(new Set(data.filter((r) => r.esGoldery).map((r) => r.segmento))).filter((s) => s && s !== "Sin clasificar");
  const segmentosCompartidos = segmentosPareto80.filter((s) => segmentosGoldery.includes(s));

  const golderyPresente = segmentosGoldery.length > 0;
  let caso: ParetoBrandDiagnosis["caso"];
  let mensaje: string;

  if (!golderyPresente) {
    caso = "sin-goldery";
    mensaje = `${marcaPropia} no aparece en la data cargada de esta categoría — no se puede diagnosticar la presencia en el Pareto.`;
  } else if (golderyEn80 >= 2) {
    caso = "ok";
    mensaje = `${marcaPropia} tiene ${golderyEn80} SKU(s) dentro del 80% del volumen; presencia razonable. El foco debe ser optimizar precio y claim, no portafolio.`;
  } else if (segmentosCompartidos.length === 0) {
    caso = "brecha-portafolio";
    mensaje = `Brecha de portafolio: los SKUs que mueven el 80% viven en los tamaños ${segmentosPareto80.join(", ")}, pero ${marcaPropia} solo tiene presencia en ${segmentosGoldery.join(", ") || "otros tamaños"}. No estás compitiendo en los tamaños que la categoría realmente compra.`;
  } else {
    caso = "brecha-conversion";
    mensaje = `Brecha de conversión: ${marcaPropia} sí tiene SKUs en los tamaños del Pareto (${segmentosCompartidos.join(", ")}), pero no capturan volumen suficiente para entrar al top 80%. El portafolio está en los tamaños correctos — revisar precio, visibilidad en percha, empaque y claim.`;
  }

  return { golderyEn80, segmentosPareto80, segmentosGoldery, segmentosCompartidos, caso, mensaje };
}

/** Rows con tamaño vacío/no legible — se descartan del análisis pero pueden ser volumen relevante. */
export function unclassifiedStats(
  rawRows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
  data: NormalizedSku[],
): {
  skus: number;
  unidades: number;
  ejemplos: string[];
  totalUnidades: number;
  pctUnidades: number;
} {
  const totalUnidades = data.reduce((s, r) => s + r.unidades, 0) || 1;
  const tCol = mapping.tamano;
  const mCol = mapping.marca;
  const dCol = mapping.descripcion;
  const uCol = mapping.unidades;
  if (!tCol) return { skus: 0, unidades: 0, ejemplos: [], totalUnidades, pctUnidades: 0 };
  const bad: { marca: string; desc: string; unidades: number }[] = [];
  for (const r of rawRows) {
    const t = String(r[tCol] ?? "").trim();
    if (t && parseSize(t).ml > 0) continue;
    const marca = String((mCol && r[mCol]) ?? "").trim();
    if (!marca) continue;
    const unidades = Number((uCol && r[uCol]) ?? 0) || 0;
    if (unidades <= 0) continue;
    bad.push({ marca, desc: String((dCol && r[dCol]) ?? "").trim(), unidades });
  }
  const unidades = bad.reduce((s, r) => s + r.unidades, 0);
  const ejemplos = bad
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 4)
    .map((r) => `${r.marca}${r.desc ? " · " + r.desc : ""} (${r.unidades.toLocaleString()} u)`);
  return { skus: bad.length, unidades, ejemplos, totalUnidades, pctUnidades: unidades / (totalUnidades + unidades) };
}

/* ============================================================
 * Sugerencia de bandas cuando >5% del volumen queda "Sin clasificar"
 * porque los tamaños reales no caen en ninguna banda existente.
 * ============================================================ */
export interface UnclassifiedBandsSuggestion {
  pctVolumen: number;
  skus: number;
  suggested: SegmentRange[];
  tamanosEjemplo: number[];
}

export function unclassifiedBandsSuggestion(data: NormalizedSku[]): UnclassifiedBandsSuggestion {
  const total = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const uncl = data.filter((r) => r.segmento === "Sin clasificar" && r.tamanoMl > 0);
  const volUncl = uncl.reduce((s, r) => s + r.volumenMl, 0);
  const sizes = uncl.map((r) => r.tamanoMl).sort((a, b) => a - b);
  // clustering 1D por proximidad (15%)
  const clusters: number[][] = [];
  for (const sz of sizes) {
    const last = clusters[clusters.length - 1];
    if (last && sz <= last[last.length - 1] * 1.15) last.push(sz);
    else clusters.push([sz]);
  }
  const suggested: SegmentRange[] = clusters.map((c) => {
    const mid = c[Math.floor(c.length / 2)];
    const roundTo = mid >= 5000 ? 1000 : mid >= 1000 ? 500 : 100;
    const center = Math.round(mid / roundTo) * roundTo;
    return { label: `~${center} ml`, min: Math.min(...c), max: Math.max(...c) };
  });
  const tamanosEjemplo = Array.from(new Set(sizes)).slice(0, 8);
  return { pctVolumen: volUncl / total, skus: uncl.length, suggested, tamanosEjemplo };
}

/** Fusiona bandas nuevas con las existentes, ordenadas por min y sin duplicar labels. */
export function mergeSegmentBands(existing: SegmentRange[], nuevas: SegmentRange[]): SegmentRange[] {
  const map = new Map<string, SegmentRange>();
  for (const s of existing) map.set(s.label, s);
  for (const s of nuevas) if (!map.has(s.label)) map.set(s.label, s);
  return [...map.values()].sort((a, b) => a.min - b.min);
}
