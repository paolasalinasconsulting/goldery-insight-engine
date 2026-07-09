import type { RawRow } from "./types";

const brands = [
  { m: "ARIEL", base: 0.85, vol: 1.0 },
  { m: "ACE", base: 0.78, vol: 0.7 },
  { m: "PERLA", base: 0.55, vol: 0.55 },
  { m: "MAGIA BLANCA", base: 0.6, vol: 0.5 },
  { m: "OLA", base: 0.45, vol: 0.4 },
  { m: "DEJA", base: 0.72, vol: 0.45 },
  { m: "GOLDERY", base: 0.5, vol: 0.18 },
  { m: "ANA", base: 0.48, vol: 0.12 },
  { m: "ELIXIR", base: 0.52, vol: 0.08 },
];
const sizes = [500, 1000, 1300, 1800, 2500, 3000, 4000, 5000];
const sizeWeight: Record<number, number> = {
  500: 0.08, 1000: 0.12, 1300: 0.1, 1800: 0.22, 2500: 0.16, 3000: 0.12, 4000: 0.1, 5000: 0.1,
};
const variedades = ["Original", "Floral", "Frescura", "Bebé", "Cítrico"];

export function buildMockRows(): RawRow[] {
  const rows: RawRow[] = [];
  let i = 0;
  for (const b of brands) {
    for (const s of sizes) {
      if (b.m === "GOLDERY" && s >= 4000) continue;
      if (b.m === "ANA" && s >= 2500) continue;
      for (let vi = 0; vi < (s <= 1300 ? 3 : 2); vi++) {
        const variedad = variedades[(vi + sizes.indexOf(s)) % variedades.length];
        const u = Math.round(b.vol * sizeWeight[s] * 9000 * (0.7 + Math.random() * 0.6));
        const pvp = +(s * b.base / 1000 * (0.95 + Math.random() * 0.1)).toFixed(2);
        rows.push({
          Categoria: "Detergente líquido",
          Marca: b.m,
          Producto: `${b.m} ${s} ml ${variedad}`,
          Variedad: variedad,
          Empaque: s >= 3000 ? "Galón" : "Botella",
          Tamaño: `${s} ml`,
          Unidades: u,
          PVP: pvp,
          Ventas: +(u * pvp).toFixed(2),
          Periodo: "2025-Q3",
          Cadena: "Autoservicio Nacional",
          Codigo: `SKU${(++i).toString().padStart(4, "0")}`,
        });
      }
    }
  }
  return rows;
}

export const MOCK_COLUMN_MAP = {
  categoria: "Categoria",
  marca: "Marca",
  descripcion: "Producto",
  variedad: "Variedad",
  empaque: "Empaque",
  tamano: "Tamaño",
  unidades: "Unidades",
  pvp: "PVP",
  ventasValor: "Ventas",
  periodo: "Periodo",
  cadena: "Cadena",
  codigo: "Codigo",
} as const;
