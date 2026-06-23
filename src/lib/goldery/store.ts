import { create } from "zustand";
import type { CanonicalField, NormalizedSku, RawRow, Settings } from "./types";
import { DEFAULT_SETTINGS, normalizeRows } from "./calc";
import { buildMockRows, MOCK_COLUMN_MAP } from "./mock";

export interface ClaimRow {
  id: string;
  claim: string;
  marcasUsan: string;
  loUsaLider: boolean;
  loTieneGoldery: boolean;
  goldery PuedeDecirlo?: boolean;
  goldery_puede: boolean;
  consumidor_entiende: boolean;
}

export interface PackChecklist {
  sku: string;
  items: boolean[];   // 10 items
}

export interface MercaditoScenario {
  nombre: string;
  sku: string;
  precio: number;
  claim: string;
  intencion: number;     // 0-100
  preferencia: number;
  calidad: number;
  ahorro: number;
  claridad: number;
  comentarios: string;
}

interface GolderyState {
  categoria: string;
  periodo: string;
  cadena: string;
  pais: string;
  fileName: string;
  rawRows: RawRow[];
  rawColumns: string[];
  mapping: Partial<Record<CanonicalField, string>>;
  settings: Settings;
  data: NormalizedSku[];
  claims: {
    id: string;
    claim: string;
    marcasUsan: string;
    loUsaLider: boolean;
    loTieneGoldery: boolean;
    goldery_puede: boolean;
    consumidor_entiende: boolean;
  }[];
  packChecks: PackChecklist[];
  mercaditoA: MercaditoScenario;
  mercaditoB: MercaditoScenario;
  setCategoria: (c: string) => void;
  setContext: (p: Partial<Pick<GolderyState, "periodo" | "cadena" | "pais">>) => void;
  setRaw: (rows: RawRow[], cols: string[], fileName: string) => void;
  setMapping: (m: Partial<Record<CanonicalField, string>>) => void;
  recalc: () => void;
  loadMock: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setClaims: (c: GolderyState["claims"]) => void;
  setPackChecks: (p: PackChecklist[]) => void;
  setMercadito: (which: "A" | "B", patch: Partial<MercaditoScenario>) => void;
}

const DEFAULT_CLAIMS: GolderyState["claims"] = [
  { id: "c1", claim: "Quita manchas difíciles", marcasUsan: "ARIEL, ACE, DEJA", loUsaLider: true, loTieneGoldery: false, goldery_puede: true, consumidor_entiende: true },
  { id: "c2", claim: "Aroma duradero 24h", marcasUsan: "ARIEL, PERLA, MAGIA BLANCA", loUsaLider: true, loTieneGoldery: true, goldery_puede: true, consumidor_entiende: true },
  { id: "c3", claim: "Concentrado, rinde más", marcasUsan: "ACE, ARIEL", loUsaLider: true, loTieneGoldery: false, goldery_puede: true, consumidor_entiende: true },
  { id: "c4", claim: "Cuida los colores", marcasUsan: "PERLA, DEJA, OLA", loUsaLider: false, loTieneGoldery: true, goldery_puede: true, consumidor_entiende: true },
  { id: "c5", claim: "Biodegradable", marcasUsan: "OLA", loUsaLider: false, loTieneGoldery: false, goldery_puede: true, consumidor_entiende: false },
  { id: "c6", claim: "Ideal para máquina y mano", marcasUsan: "DEJA, MAGIA BLANCA", loUsaLider: false, loTieneGoldery: false, goldery_puede: true, consumidor_entiende: true },
];

const DEFAULT_PACK: PackChecklist[] = [
  { sku: "GOLDERY 1800 ml", items: [true, true, false, true, true, false, true, false, false, true] },
  { sku: "GOLDERY 3000 ml", items: [true, false, false, true, true, true, true, false, false, false] },
];

const blankMerc = (n: string): MercaditoScenario => ({
  nombre: n, sku: "GOLDERY 1800 ml", precio: 4.5, claim: "Aroma 24h",
  intencion: 32, preferencia: 28, calidad: 60, ahorro: 55, claridad: 50, comentarios: "",
});

export const useGoldery = create<GolderyState>((set, get) => ({
  categoria: "Detergente líquido",
  periodo: "2025-Q3",
  cadena: "Autoservicio Nacional",
  pais: "Ecuador",
  fileName: "(datos de prueba)",
  rawRows: [],
  rawColumns: [],
  mapping: {},
  settings: DEFAULT_SETTINGS,
  data: [],
  claims: DEFAULT_CLAIMS,
  packChecks: DEFAULT_PACK,
  mercaditoA: { ...blankMerc("Empaque actual"), intencion: 32 },
  mercaditoB: { ...blankMerc("Propuesta nueva"), intencion: 46, preferencia: 41, calidad: 72, claridad: 70 },

  setCategoria: (c) => set({ categoria: c }),
  setContext: (p) => set(p),
  setRaw: (rows, cols, fileName) => set({ rawRows: rows, rawColumns: cols, fileName, mapping: autoMap(cols) }),
  setMapping: (m) => set({ mapping: m }),
  recalc: () => {
    const s = get();
    set({ data: normalizeRows(s.rawRows, s.mapping, s.settings, s.categoria) });
  },
  loadMock: () => {
    const rows = buildMockRows();
    const cols = Object.keys(rows[0] ?? {});
    set({ rawRows: rows, rawColumns: cols, mapping: MOCK_COLUMN_MAP, fileName: "(datos de prueba)" });
    get().recalc();
  },
  updateSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    get().recalc();
  },
  setClaims: (c) => set({ claims: c }),
  setPackChecks: (p) => set({ packChecks: p }),
  setMercadito: (which, patch) =>
    set((s) => which === "A" ? { mercaditoA: { ...s.mercaditoA, ...patch } } : { mercaditoB: { ...s.mercaditoB, ...patch } }),
}));

function autoMap(cols: string[]): Partial<Record<CanonicalField, string>> {
  const lc = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const find = (...keys: string[]) => cols.find((c) => keys.some((k) => lc(c).includes(k)));
  return {
    categoria: find("categ"),
    marca: find("marca", "brand"),
    descripcion: find("producto", "descrip", "sku"),
    empaque: find("empaq", "pack", "presenta"),
    tamano: find("tama", "ml", "size", "contenido"),
    unidades: find("unidad", "cantidad", "qty", "vendid"),
    pvp: find("pvp", "precio"),
    ventasValor: find("ventas valor", "venta", "valor", "importe"),
    periodo: find("period", "fecha", "mes"),
    cadena: find("cadena", "local", "tienda"),
    codigo: find("codigo", "code", "ean"),
  };
}

// Auto-load mock on first import (client side)
if (typeof window !== "undefined") {
  setTimeout(() => {
    const s = useGoldery.getState();
    if (s.data.length === 0) s.loadMock();
  }, 0);
}
