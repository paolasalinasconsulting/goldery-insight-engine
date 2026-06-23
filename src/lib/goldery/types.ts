export type RawRow = Record<string, unknown>;

export type CanonicalField =
  | "categoria"
  | "marca"
  | "descripcion"
  | "empaque"
  | "tamano"
  | "unidad"
  | "unidades"
  | "pvp"
  | "ventasValor"
  | "periodo"
  | "cadena"
  | "codigo";

export const CANONICAL_FIELDS: { key: CanonicalField; label: string; required?: boolean }[] = [
  { key: "categoria", label: "Categoría" },
  { key: "marca", label: "Marca", required: true },
  { key: "descripcion", label: "Descripción / SKU", required: true },
  { key: "empaque", label: "Empaque" },
  { key: "tamano", label: "Tamaño / contenido", required: true },
  { key: "unidad", label: "Unidad de medida" },
  { key: "unidades", label: "Unidades vendidas", required: true },
  { key: "pvp", label: "Precio PVP" },
  { key: "ventasValor", label: "Ventas valor" },
  { key: "periodo", label: "Periodo / fecha" },
  { key: "cadena", label: "Cadena / local" },
  { key: "codigo", label: "Código producto" },
];

export interface NormalizedSku {
  id: string;
  categoria: string;
  marca: string;
  descripcion: string;
  empaque: string;
  tamanoMl: number;        // normalized to ml (or g for solids treated as ml-equivalent)
  unidad: "ml" | "g" | "u";
  unidades: number;
  pvp: number;             // unit price
  ventasValor: number;
  volumenMl: number;       // unidades * tamanoMl
  volumenL: number;
  toneladas: number;
  precioPorMl: number;
  segmento: string;
  esGoldery: boolean;
}

export interface SegmentRange {
  label: string;
  min: number;    // ml inclusive
  max: number;    // ml inclusive (Infinity for last bucket)
}

export interface Settings {
  marcaPropia: string;
  marcasPropias: string[];           // Goldery, Ana, Elixir, ...
  densidad: number;                   // kg/L
  segmentos: SegmentRange[];
  umbralOportunidad: { alta: number; media: number };
  umbralIndicePrecio: { muyBarato: number; valor: number; paridad: number; sobreprecio: number };
}
