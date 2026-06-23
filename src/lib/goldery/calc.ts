import type { NormalizedSku, RawRow, CanonicalField, Settings, SegmentRange } from "./types";
import { parseSize, toNumber, normalizeBrand } from "./parse";

export const DEFAULT_SEGMENTS: SegmentRange[] = [
  { label: "Pequeño (0-500 ml)", min: 0, max: 500 },
  { label: "900-1000 ml", min: 501, max: 1000 },
  { label: "1300 ml", min: 1001, max: 1500 },
  { label: "1800 ml", min: 1501, max: 2000 },
  { label: "2500 ml", min: 2001, max: 2800 },
  { label: "3000 ml", min: 2801, max: 3200 },
  { label: "3500-4000 ml", min: 3201, max: 4500 },
  { label: "5000 ml+", min: 4501, max: Infinity },
];

export const DEFAULT_SETTINGS: Settings = {
  marcaPropia: "GOLDERY",
  marcasPropias: ["GOLDERY", "ANA", "ELIXIR", "REGENEXT", "BOMBA"],
  densidad: 1.0,
  segmentos: DEFAULT_SEGMENTS,
  umbralOportunidad: { alta: 75, media: 50 },
  umbralIndicePrecio: { muyBarato: 85, valor: 95, paridad: 105, sobreprecio: 115 },
};

export function segmentOf(ml: number, segs: SegmentRange[]): string {
  return segs.find((s) => ml >= s.min && ml <= s.max)?.label ?? "Sin clasificar";
}

export function normalizeRows(
  rows: RawRow[],
  mapping: Partial<Record<CanonicalField, string>>,
  settings: Settings,
  categoria: string,
): NormalizedSku[] {
  const out: NormalizedSku[] = [];
  rows.forEach((r, i) => {
    const get = (k: CanonicalField) => (mapping[k] ? r[mapping[k]!] : undefined);
    const tam = parseSize(get("tamano"));
    const unidades = toNumber(get("unidades"));
    const pvp = toNumber(get("pvp"));
    const marca = normalizeBrand(get("marca"));
    if (!marca || tam.ml <= 0 || unidades <= 0) return;
    const volumenMl = unidades * tam.ml;
    const volumenL = volumenMl / 1000;
    const ventasValor = toNumber(get("ventasValor")) || unidades * pvp;
    out.push({
      id: `row-${i}`,
      categoria: String(get("categoria") ?? categoria ?? "").trim() || categoria,
      marca,
      descripcion: String(get("descripcion") ?? "").trim(),
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
  return out;
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
  indicePrecio: number;       // 0 if no presence
  participaGoldery: boolean;
  scoreOportunidad: number;
  nivelOportunidad: "Alta" | "Media" | "Baja";
  diagnostico: string;
  recomendacion: "no-hacer" | "ajuste" | "lanzar";
}

export function analyzeSegments(data: NormalizedSku[], settings: Settings): SegmentAnalysis[] {
  const totalCat = data.reduce((s, r) => s + r.volumenMl, 0) || 1;
  const out: SegmentAnalysis[] = [];
  for (const seg of settings.segmentos) {
    const rows = data.filter((r) => r.segmento === seg.label);
    if (rows.length === 0) continue;
    const volumenMl = rows.reduce((s, r) => s + r.volumenMl, 0);
    const pesoCategoria = volumenMl / totalCat;

    const byBrand = new Map<string, { vol: number; precioMl: number; n: number; esGoldery: boolean }>();
    for (const r of rows) {
      const cur = byBrand.get(r.marca) ?? { vol: 0, precioMl: 0, n: 0, esGoldery: r.esGoldery };
      cur.vol += r.volumenMl;
      cur.precioMl += r.precioPorMl;
      cur.n += 1;
      byBrand.set(r.marca, cur);
    }
    const brands = [...byBrand.entries()]
      .map(([marca, v]) => ({ marca, vol: v.vol, precioMl: v.precioMl / v.n, esGoldery: v.esGoldery }))
      .sort((a, b) => b.vol - a.vol);
    const lider = brands[0];

    const goldery = brands.find((b) => b.esGoldery);
    const participa = !!goldery;
    const volumenGoldery = goldery?.vol ?? 0;
    const shareGolderyEnSegmento = volumenGoldery / volumenMl;
    const gapVsLider = (lider.vol - volumenGoldery) / volumenMl;
    const indicePrecio = goldery && lider.precioMl > 0
      ? (goldery.precioMl / lider.precioMl) * 100
      : 0;

    // Opportunity score
    const pesoPts = Math.min(pesoCategoria * 100, 40);                 // 0-40
    const ausenciaPts = participa
      ? Math.max(0, 25 - shareGolderyEnSegmento * 100)
      : 25;                                                             // 0-25
    const liderConc = (lider.vol / volumenMl) * 15;                    // 0-15
    const precioPts = indicePrecio === 0 ? 7 : indicePrecio < 105 ? 10 : indicePrecio < 115 ? 6 : 3;
    const factibilidad = participa ? 8 : 6;
    const score = Math.round(pesoPts + ausenciaPts + liderConc + precioPts + factibilidad);

    const nivel = score >= settings.umbralOportunidad.alta
      ? "Alta"
      : score >= settings.umbralOportunidad.media
        ? "Media"
        : "Baja";

    // Diagnóstico
    let diagnostico = "";
    let recomendacion: SegmentAnalysis["recomendacion"] = "no-hacer";
    if (!participa && pesoCategoria > 0.1) {
      diagnostico = `Goldery no participa en un segmento que concentra el ${(pesoCategoria * 100).toFixed(1)}% de la categoría. Líder ${lider.marca} domina con ${((lider.vol / volumenMl) * 100).toFixed(0)}%.`;
      recomendacion = nivel === "Baja" ? "no-hacer" : "lanzar";
    } else if (participa && indicePrecio > 0 && indicePrecio < 95 && shareGolderyEnSegmento < 0.1) {
      diagnostico = `Goldery compite con ventaja de precio (índice ${indicePrecio.toFixed(0)}) frente a ${lider.marca}, pero el bajo share (${(shareGolderyEnSegmento * 100).toFixed(1)}%) sugiere problema de comunicación, empaque o credibilidad.`;
      recomendacion = "ajuste";
    } else if (participa && indicePrecio > 115) {
      diagnostico = `Goldery está sobreindexada en precio (índice ${indicePrecio.toFixed(0)}); riesgo de baja conversión vs ${lider.marca}.`;
      recomendacion = "ajuste";
    } else if (participa && shareGolderyEnSegmento > 0.15) {
      diagnostico = `Goldery tiene posición sólida (${(shareGolderyEnSegmento * 100).toFixed(1)}% del segmento). Mantener y proteger.`;
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
