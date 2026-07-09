export type RawRow = Record<string, unknown>;

export type CanonicalField =
  | "categoria"
  | "marca"
  | "descripcion"
  | "variedad"
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
  { key: "variedad", label: "Variedad / Aroma" },
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
  variedad: string;
  empaque: string;
  tamanoMl: number;
  unidad: "ml" | "g" | "u";
  unidades: number;
  pvp: number;
  ventasValor: number;
  volumenMl: number;
  volumenL: number;
  toneladas: number;
  precioPorMl: number;
  segmento: string;
  esGoldery: boolean;
}

export interface SegmentRange {
  label: string;
  min: number;
  max: number;
}

export type TriState = "si" | "no" | "duda";

export interface ClaimRow {
  id: string;
  claim: string;
  marcasUsan: string;
  loUsaLider: boolean;
  loTieneGoldery: TriState;
  goldery_puede: TriState;      // aplica cuando loTieneGoldery = "no"
  consumidor_entiende: TriState; // aplica cuando loTieneGoldery = "si"
}

export interface Settings {
  marcaPropia: string;
  marcasPropias: string[];
  densidad: number;
  segmentos: SegmentRange[];
  liderManual?: string; // override manual del líder de la categoría activa
  comparacionesPrecio: Record<string, string>; // segmento -> marca contra la que se compara
  umbralOportunidad: { alta: number; media: number };
  umbralIndicePrecio: { muyBarato: number; valor: number; paridad: number; sobreprecio: number };
}
