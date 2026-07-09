import type { NormalizedSku, RawRow, CanonicalField, Settings, SegmentRange } from "./types";
import { parseSize, toNumber, normalizeBrand } from "./parse";

export const DEFAULT_SEGMENTS: SegmentRange[] = [
  { label: "Pequeño (0-500 ml)", min: 0, max: 500 },
  { label: "~1000 ml", min: 501, max: 1200 },
  { label: "~1300 ml", min: 1201, max: 1500 },
  { label: "~1800 ml", min: 1501, max: 2200 },
  { label: "~2500 ml", min: 2201, max: 2800 },
  { label: "~3000 ml", min: 2801, max: 3400 },
  { label: "~4000 ml", min: 3401, max: 4500 },
  { label: "5000 ml+", min: 4501, max: Infinity },
];

export const DEFAULT_SETTINGS: Settings = {
  marcaPropia: "GOLDERY",
  marcasPropias: ["GOLDERY", "ANA", "ELIXIR", "REGENEXT", "BOMBA"],
  densidad: 1.0,
  segmentos: DEFAULT_SEGMENTS,
  liderManual: undefined,
  comparacionesPrecio: {},
  umbralOportunidad: { alta: 75, media: 50 },
  umbralIndicePrecio: { muyBarato: 85, valor: 95, paridad: 105, sobreprecio: 115 },
};

export function segmentOf(ml: number, segs: SegmentRange[]): string {
  return segs.find((s) => ml >= s.min && ml <= s.max)?.label ?? "Sin clasificar";
}

export interface NormalizeReport {
  data: NormalizedSku[];
  descartadas: { motivo: string; count: number }[];
  sinPVP: number;
}

export function normalizeRowsReport(
  rows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
  settings: Settings,
  categoria: string,
): NormalizeReport {
  const out: NormalizedSku[] = [];
  let sinMarca = 0, tamCero = 0, unidNoPos = 0, sinPVP = 0;
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
    out.push({
      id: `row-${i}`,
      categoria: String(get("categoria") ?? categoria ?? "").trim() || categoria,
      marca,
      descripcion: String(get("descripcion") ?? "").trim(),
      variedad: String(get("variedad") ?? "").trim() || "Sin variedad",
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
): NormalizedSku[] {
  return normalizeRowsReport(rows, mapping, settings, categoria).data;
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
  const map = new Map<string, PriceRow & { _sumPvp: number }>();
  for (const r of data) {
    if (r.tamanoMl <= 0 || r.pvp <= 0) continue;
    const k = `${r.segmento}||${r.marca}`;
    const cur = map.get(k) ?? {
      segmento: r.segmento, marca: r.marca,
      precioMlPromedio: 0, volumenMl: 0, unidades: 0,
      esGoldery: r.esGoldery, _sumPvp: 0,
    };
    // promedio ponderado por unidades del precio/ml
    cur._sumPvp += r.precioPorMl * r.unidades;
    cur.volumenMl += r.volumenMl;
    cur.unidades += r.unidades;
    map.set(k, cur);
  }
  const out: PriceRow[] = [];
  for (const v of map.values()) {
    out.push({
      segmento: v.segmento,
      marca: v.marca,
      precioMlPromedio: v.unidades > 0 ? v._sumPvp / v.unidades : 0,
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
  semaforo: "verde" | "rojo" | "gris";
}
export function priceComparisonBySegment(
  data: NormalizedSku[],
  settings: Settings,
): PriceComparison[] {
  const matrix = priceMatrix(data);
  const out: PriceComparison[] = [];
  for (const seg of settings.segmentos) {
    const rows = matrix.filter((r) => r.segmento === seg.label);
    if (rows.length === 0) continue;
    const marcasEnSeg = rows.slice().sort((a, b) => b.volumenMl - a.volumenMl);
    // marca elegida: la del override, si existe en el segmento; si no, la de mayor volumen no-propia; si no, la mayor
    let elegida = settings.comparacionesPrecio[seg.label];
    if (!elegida || !marcasEnSeg.some((m) => m.marca === elegida)) {
      elegida = marcasEnSeg.find((m) => !m.esGoldery)?.marca ?? marcasEnSeg[0].marca;
    }
    const comparada = rows.find((r) => r.marca === elegida)!;
    const mi = rows.find((r) => r.esGoldery && r.marca !== elegida) ?? rows.find((r) => r.esGoldery);
    const volSeg = rows.reduce((s, r) => s + r.volumenMl, 0);
    const indice = mi && comparada.precioMlPromedio > 0
      ? (mi.precioMlPromedio / comparada.precioMlPromedio) * 100
      : 0;
    out.push({
      segmento: seg.label,
      marcaComparada: elegida,
      precioMlComparado: comparada.precioMlPromedio,
      precioMlMiMarca: mi?.precioMlPromedio ?? 0,
      indice,
      miMarcaPresente: !!mi,
      volumenSegmento: volSeg,
      semaforo: !mi ? "gris" : indice < 100 ? "verde" : "rojo",
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
  indicePrecioPromedio: number;     // ponderado por volumen del segmento
  segmentosMasBarato: number;       // #segmentos con índice < 100
  segmentosTotal: number;
  claimsCubiertos: number;          // 0-1
  claimsTotal: number;
  claimsTengo: number;
  tieneData: boolean;
}
export function categorySummary(
  data: NormalizedSku[],
  settings: Settings,
  claims: { loTieneGoldery: string }[],
): CategorySummary {
  const brands = brandRanking(data);
  const mi = brands.find((b) => b.marca === settings.marcaPropia) ?? brands.find((b) => b.esGoldery);
  const comps = priceComparisonBySegment(data, settings);
  const compsMi = comps.filter((c) => c.miMarcaPresente && c.indice > 0);
  const wTot = compsMi.reduce((s, c) => s + c.volumenSegmento, 0) || 1;
  const idxProm = compsMi.reduce((s, c) => s + c.indice * c.volumenSegmento, 0) / wTot;
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
  };
}
