import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CanonicalField, ClaimRow, NormalizedSku, RawRow, Settings } from "./types";
import { DEFAULT_SETTINGS, normalizeRows, buildPriceSnapshot, overrideKey, mergeSegmentBands, type PriceSnapshot } from "./calc";
import { buildMockRows, MOCK_COLUMN_MAP } from "./mock";

/** Opciones de normalización derivadas del estado activo (dict + overrides de variedad). */
function normOptsFor(settings: Settings, categoria: string, overrides?: Record<string, string>) {
  return {
    variedadDict: settings.variedadDict?.[categoria] ?? [],
    variedadOverrides: overrides ?? {},
  };
}


export interface PackChecklist {
  sku: string;
  items: boolean[];
}

export interface MercaditoScenario {
  nombre: string;
  sku: string;
  precio: number;
  claim: string;
  intencion: number;
  preferencia: number;
  calidad: number;
  ahorro: number;
  claridad: number;
  comentarios: string;
}

interface CategoriaState {
  rawRows: RawRow[];
  rawColumns: string[];
  mapping: Partial<Record<CanonicalField, string>>;
  fileName: string;
  periodo: string;
  cadena: string;
  pais: string;
  claims: ClaimRow[];
  packChecks: PackChecklist[];
  liderManual?: string;
  comparacionesPrecio: Record<string, string>;
  priceHistory: PriceSnapshot[];
  /** Overrides manuales de variedad por SKU (clave = descripción normalizada). */
  variedadOverrides?: Record<string, string>;
}

interface GolderyState {
  categoria: string;
  categorias: string[];                            // lista de categorías registradas
  categoriasGuardadas: Record<string, CategoriaState>;
  // vista activa (proyectada desde categoriasGuardadas[categoria])
  periodo: string;
  cadena: string;
  pais: string;
  fileName: string;
  rawRows: RawRow[];
  rawColumns: string[];
  mapping: Partial<Record<CanonicalField, string>>;
  settings: Settings;
  data: NormalizedSku[];
  claims: ClaimRow[];
  packChecks: PackChecklist[];
  priceHistory: PriceSnapshot[];
  variedadOverrides: Record<string, string>;
  mercaditoA: MercaditoScenario;
  mercaditoB: MercaditoScenario;

  setCategoria: (c: string) => void;               // alias legado — llama cambiarCategoria
  cambiarCategoria: (c: string) => void;
  nuevaCategoria: (c: string) => void;
  eliminarCategoria: (c: string) => void;
  setContext: (p: Partial<Pick<GolderyState, "periodo" | "cadena" | "pais">>) => void;
  setRaw: (rows: RawRow[], cols: string[], fileName: string) => void;
  setMapping: (m: Partial<Record<CanonicalField, string>>) => void;
  agregarFilaManual: (row: RawRow) => void;
  eliminarFilaManual: (idx: number) => void;
  actualizarFilaManual: (idx: number, patch: Partial<RawRow>) => void;
  recalc: () => void;
  loadMock: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setLiderManual: (m: string | undefined) => void;
  setComparacionPrecio: (segmento: string, marca: string) => void;
  setClaims: (c: ClaimRow[]) => void;
  setPackChecks: (p: PackChecklist[]) => void;
  setMercadito: (which: "A" | "B", patch: Partial<MercaditoScenario>) => void;
  exportBackup: () => string;
  importBackup: (json: string) => { ok: boolean; error?: string };
  clearPriceHistory: () => void;
  consolidarDuplicados: (keys: string[]) => number;
  setVariedadOverride: (descripcion: string, variedad: string) => void;
  clearVariedadOverride: (descripcion: string) => void;
  reprocesarVariedades: () => void;
  updateVariedadDict: (categoria: string, terminos: string[]) => void;
  aplicarBandasSugeridas: (nuevas: { label: string; min: number; max: number }[]) => void;
}

const DEFAULT_CLAIMS: ClaimRow[] = [
  { id: "c1", claim: "Quita manchas difíciles", marcasUsan: "ARIEL, ACE, DEJA", loUsaLider: true, loTieneGoldery: "no", goldery_puede: "si", consumidor_entiende: "si" },
  { id: "c2", claim: "Aroma duradero 24h", marcasUsan: "ARIEL, PERLA, MAGIA BLANCA", loUsaLider: true, loTieneGoldery: "si", goldery_puede: "si", consumidor_entiende: "si" },
  { id: "c3", claim: "Concentrado, rinde más", marcasUsan: "ACE, ARIEL", loUsaLider: true, loTieneGoldery: "no", goldery_puede: "si", consumidor_entiende: "si" },
  { id: "c4", claim: "Cuida los colores", marcasUsan: "PERLA, DEJA, OLA", loUsaLider: false, loTieneGoldery: "si", goldery_puede: "si", consumidor_entiende: "si" },
  { id: "c5", claim: "Biodegradable", marcasUsan: "OLA", loUsaLider: false, loTieneGoldery: "no", goldery_puede: "duda", consumidor_entiende: "no" },
  { id: "c6", claim: "Ideal para máquina y mano", marcasUsan: "DEJA, MAGIA BLANCA", loUsaLider: false, loTieneGoldery: "no", goldery_puede: "si", consumidor_entiende: "si" },
];

const DEFAULT_PACK: PackChecklist[] = [
  { sku: "GOLDERY 1800 ml", items: [true, true, false, true, true, false, true, false, false, true] },
  { sku: "GOLDERY 3000 ml", items: [true, false, false, true, true, true, true, false, false, false] },
];

const blankMerc = (n: string): MercaditoScenario => ({
  nombre: n, sku: "GOLDERY 1800 ml", precio: 4.5, claim: "Aroma 24h",
  intencion: 32, preferencia: 28, calidad: 60, ahorro: 55, claridad: 50, comentarios: "",
});

function estadoBlanco(seedClaims: ClaimRow[] = []): CategoriaState {
  return {
    rawRows: [], rawColumns: [], mapping: {}, fileName: "(sin datos)",
    periodo: "2025-Q3", cadena: "Autoservicio Nacional", pais: "Ecuador",
    claims: seedClaims, packChecks: DEFAULT_PACK,
    liderManual: undefined, comparacionesPrecio: {},
    priceHistory: [],
  };
}

/** Heurística: los textos coinciden con la plantilla sembrada de Detergente líquido. */
function looksLikeDetergentSeed(a: ClaimRow[] | undefined): boolean {
  if (!a || a.length === 0) return false;
  const defTexts = new Set(DEFAULT_CLAIMS.map((c) => c.claim));
  const hits = a.filter((c) => defTexts.has(c.claim)).length;
  // Si >=60% de los claims coinciden textualmente con la semilla de Detergente,
  // asumimos que la categoría heredó el seed original y lo limpiamos.
  return hits / a.length >= 0.6 && hits >= 3;
}

/** Limpia claims sembrados por error en categorías distintas de "Detergente líquido". */
export function migrateClaimsPerCategoria(
  guardadas: Record<string, CategoriaState>,
): { guardadas: Record<string, CategoriaState>; changed: boolean } {
  const next = { ...guardadas };
  let changed = false;
  for (const [cat, snap] of Object.entries(next)) {
    if (cat === "Detergente líquido" || !snap) continue;
    if (looksLikeDetergentSeed(snap.claims)) {
      next[cat] = { ...snap, claims: [] };
      changed = true;
    }
  }
  return { guardadas: next, changed };
}

function proyectar(state: CategoriaState, settings: Settings, categoria: string) {
  return {
    ...state,
    settings: { ...settings, liderManual: state.liderManual, comparacionesPrecio: state.comparacionesPrecio },
    data: normalizeRows(state.rawRows, state.mapping, settings, categoria),
  };
}

export const useGoldery = create<GolderyState>()(
  persist(
    (set, get) => ({
      categoria: "Detergente líquido",
      categorias: ["Detergente líquido"],
      categoriasGuardadas: { "Detergente líquido": estadoBlanco(DEFAULT_CLAIMS) },
      periodo: "2025-Q3",
      cadena: "Autoservicio Nacional",
      pais: "Ecuador",
      fileName: "(sin datos)",
      rawRows: [],
      rawColumns: [],
      mapping: {},
      settings: DEFAULT_SETTINGS,
      data: [],
      claims: DEFAULT_CLAIMS,
      packChecks: DEFAULT_PACK,
      priceHistory: [],
      variedadOverrides: {},
      mercaditoA: { ...blankMerc("Empaque actual"), intencion: 32 },
      mercaditoB: { ...blankMerc("Propuesta nueva"), intencion: 46, preferencia: 41, calidad: 72, claridad: 70 },

      setCategoria: (c) => get().cambiarCategoria(c),

      cambiarCategoria: (c) => {
        const s = get();
        // snapshot de la categoría actual
        const snapshot: CategoriaState = {
          rawRows: s.rawRows, rawColumns: s.rawColumns, mapping: s.mapping,
          fileName: s.fileName, periodo: s.periodo, cadena: s.cadena, pais: s.pais,
          claims: s.claims, packChecks: s.packChecks,
          liderManual: s.settings.liderManual,
          comparacionesPrecio: s.settings.comparacionesPrecio,
          priceHistory: s.priceHistory ?? [],
          variedadOverrides: s.variedadOverrides ?? {},
        };
        const guardadas = { ...s.categoriasGuardadas, [s.categoria]: snapshot };
        const destino = guardadas[c] ?? estadoBlanco();
        const cats = s.categorias.includes(c) ? s.categorias : [...s.categorias, c];
        const settingsNext: Settings = {
          ...s.settings,
          liderManual: destino.liderManual,
          comparacionesPrecio: destino.comparacionesPrecio,
        };
        const destOvr = destino.variedadOverrides ?? {};
        set({
          categoria: c,
          categorias: cats,
          categoriasGuardadas: guardadas,
          ...destino,
          variedadOverrides: destOvr,
          settings: settingsNext,
          data: normalizeRows(destino.rawRows, destino.mapping, settingsNext, c, normOptsFor(settingsNext, c, destOvr)),
        });
      },

      nuevaCategoria: (c) => {
        const s = get();
        if (s.categorias.includes(c)) { get().cambiarCategoria(c); return; }
        set({
          categorias: [...s.categorias, c],
          categoriasGuardadas: { ...s.categoriasGuardadas, [c]: estadoBlanco() },
        });
        get().cambiarCategoria(c);
      },

      eliminarCategoria: (c) => {
        const s = get();
        if (s.categorias.length <= 1) return;
        const cats = s.categorias.filter((x) => x !== c);
        const { [c]: _, ...rest } = s.categoriasGuardadas;
        set({ categorias: cats, categoriasGuardadas: rest });
        if (s.categoria === c) get().cambiarCategoria(cats[0]);
      },

      setContext: (p) => set(p),
      setRaw: (rows, cols, fileName) => set({ rawRows: rows, rawColumns: cols, fileName, mapping: autoMap(cols) }),
      setMapping: (m) => set({ mapping: m }),

      agregarFilaManual: (row) => {
        const s = get();
        const rows = [...s.rawRows, row];
        const cols = s.rawColumns.length ? s.rawColumns : Object.keys(row);
        const mapping = Object.keys(s.mapping).length ? s.mapping : (autoMap(cols) as any);
        set({
          rawRows: rows,
          rawColumns: cols,
          mapping,
          fileName: s.fileName === "(sin datos)" ? "(entrada manual)" : s.fileName,
          data: normalizeRows(rows, mapping, s.settings, s.categoria, normOptsFor(s.settings, s.categoria, s.variedadOverrides)),
        });
      },
      eliminarFilaManual: (idx) => {
        const s = get();
        const rows = s.rawRows.filter((_, i) => i !== idx);
        set({ rawRows: rows, data: normalizeRows(rows, s.mapping, s.settings, s.categoria, normOptsFor(s.settings, s.categoria, s.variedadOverrides)) });
      },
      actualizarFilaManual: (idx, patch) => {
        const s = get();
        const rows = s.rawRows.map((r, i) => i === idx ? { ...r, ...patch } : r);
        set({ rawRows: rows, data: normalizeRows(rows, s.mapping, s.settings, s.categoria, normOptsFor(s.settings, s.categoria, s.variedadOverrides)) });
      },

      recalc: () => {
        const s = get();
        const data = normalizeRows(s.rawRows, s.mapping, s.settings, s.categoria, normOptsFor(s.settings, s.categoria, s.variedadOverrides));
        // snapshot histórico: solo si hay data y no hay uno del mismo día
        let priceHistory = s.priceHistory ?? [];
        if (data.length > 0) {
          const snap = buildPriceSnapshot(data, s.settings);
          const hoy = new Date().toISOString().slice(0, 10);
          const yaHoy = priceHistory.some((h) => h.fecha.slice(0, 10) === hoy);
          if (!yaHoy && snap.length > 0) {
            priceHistory = [...priceHistory, ...snap].slice(-2000); // cap
          }
        }
        set({ data, priceHistory });
      },
      loadMock: () => {
        const rows = buildMockRows();
        const cols = Object.keys(rows[0] ?? {});
        set({ rawRows: rows, rawColumns: cols, mapping: MOCK_COLUMN_MAP as any, fileName: "(datos de prueba)" });
        get().recalc();
      },
      updateSettings: (patch) => {
        set({ settings: { ...get().settings, ...patch } });
        get().recalc();
      },
      setLiderManual: (m) => {
        const s = get();
        set({ settings: { ...s.settings, liderManual: m } });
      },
      setComparacionPrecio: (segmento, marca) => {
        const s = get();
        const next = { ...s.settings.comparacionesPrecio, [segmento]: marca };
        set({ settings: { ...s.settings, comparacionesPrecio: next } });
        get().recalc();
      },
      setClaims: (c) => set({ claims: c }),
      setPackChecks: (p) => set({ packChecks: p }),
      setMercadito: (which, patch) =>
        set((s) => which === "A" ? { mercaditoA: { ...s.mercaditoA, ...patch } } : { mercaditoB: { ...s.mercaditoB, ...patch } }),

      exportBackup: () => {
        const s = get();
        // consolidar snapshot de categoría activa antes de exportar
        const snap: CategoriaState = {
          rawRows: s.rawRows, rawColumns: s.rawColumns, mapping: s.mapping,
          fileName: s.fileName, periodo: s.periodo, cadena: s.cadena, pais: s.pais,
          claims: s.claims, packChecks: s.packChecks,
          liderManual: s.settings.liderManual,
          comparacionesPrecio: s.settings.comparacionesPrecio,
          priceHistory: s.priceHistory ?? [],
          variedadOverrides: s.variedadOverrides ?? {},
        };
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          categoria: s.categoria,
          categorias: s.categorias,
          categoriasGuardadas: { ...s.categoriasGuardadas, [s.categoria]: snap },
          settings: s.settings,
          mercaditoA: s.mercaditoA, mercaditoB: s.mercaditoB,
        };
        return JSON.stringify(payload, null, 2);
      },
      importBackup: (json) => {
        try {
          const p = JSON.parse(json);
          if (!p || typeof p !== "object" || !p.categorias || !p.categoriasGuardadas) {
            return { ok: false, error: "Formato no reconocido" };
          }
          const cat = p.categoria ?? p.categorias[0];
          const dest: CategoriaState = { ...estadoBlanco(), ...(p.categoriasGuardadas[cat] ?? {}) };
          set({
            categoria: cat,
            categorias: p.categorias,
            categoriasGuardadas: p.categoriasGuardadas,
            settings: p.settings ?? DEFAULT_SETTINGS,
            mercaditoA: p.mercaditoA ?? get().mercaditoA,
            mercaditoB: p.mercaditoB ?? get().mercaditoB,
            ...dest,
            variedadOverrides: dest.variedadOverrides ?? {},
          });
          get().recalc();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
      clearPriceHistory: () => set({ priceHistory: [] }),
      consolidarDuplicados: (keys) => {
        const s = get();
        const mapping = s.mapping;
        const getV = (r: RawRow, k: CanonicalField) =>
          mapping[k] ? String(r[mapping[k]!] ?? "").trim().toLowerCase() : "";
        const keyOf = (r: RawRow) =>
          [getV(r, "marca"), getV(r, "variedad"), getV(r, "empaque"), getV(r, "tamano")].join("|");
        const target = new Set(keys);
        const groups = new Map<string, number[]>();
        s.rawRows.forEach((r, i) => {
          const k = keyOf(r);
          const arr = groups.get(k) ?? [];
          arr.push(i);
          groups.set(k, arr);
        });
        let mergedGroups = 0;
        const toRemove = new Set<number>();
        const patched = [...s.rawRows];
        const uCol = mapping.unidades;
        const vCol = mapping.ventasValor;
        for (const [k, idxs] of groups) {
          if (!target.has(k) || idxs.length < 2) continue;
          const [first, ...rest] = idxs;
          let sumU = Number((uCol && patched[first][uCol]) ?? 0) || 0;
          let sumV = Number((vCol && patched[first][vCol]) ?? 0) || 0;
          for (const j of rest) {
            sumU += Number((uCol && patched[j][uCol]) ?? 0) || 0;
            sumV += Number((vCol && patched[j][vCol]) ?? 0) || 0;
            toRemove.add(j);
          }
          if (uCol) patched[first] = { ...patched[first], [uCol]: sumU };
          if (vCol) patched[first] = { ...patched[first], [vCol]: sumV };
          mergedGroups++;
        }
        const nextRows = patched.filter((_, i) => !toRemove.has(i));
        set({ rawRows: nextRows });
        get().recalc();
        return mergedGroups;
      },

      setVariedadOverride: (descripcion, variedad) => {
        const s = get();
        const key = overrideKey(descripcion);
        const next = { ...(s.variedadOverrides ?? {}) };
        const v = variedad.trim();
        if (v) next[key] = v; else delete next[key];
        set({ variedadOverrides: next });
        get().recalc();
      },
      clearVariedadOverride: (descripcion) => {
        const s = get();
        const key = overrideKey(descripcion);
        const next = { ...(s.variedadOverrides ?? {}) };
        delete next[key];
        set({ variedadOverrides: next });
        get().recalc();
      },
      reprocesarVariedades: () => {
        get().recalc();
      },
      updateVariedadDict: (categoria, terminos) => {
        const s = get();
        const dict = { ...(s.settings.variedadDict ?? {}), [categoria]: terminos };
        set({ settings: { ...s.settings, variedadDict: dict } });
        get().recalc();
      },
      aplicarBandasSugeridas: (nuevas) => {
        const s = get();
        const segmentos = mergeSegmentBands(s.settings.segmentos, nuevas);
        set({ settings: { ...s.settings, segmentos } });
        get().recalc();
      },
    }),

    {
      name: "categoryiq-store-v1",
      storage: typeof window !== "undefined" ? createJSONStorage(() => localStorage) : undefined,
      partialize: (s) => ({
        categoria: s.categoria,
        categorias: s.categorias,
        categoriasGuardadas: s.categoriasGuardadas,
        periodo: s.periodo, cadena: s.cadena, pais: s.pais, fileName: s.fileName,
        rawRows: s.rawRows, rawColumns: s.rawColumns, mapping: s.mapping,
        settings: s.settings, claims: s.claims, packChecks: s.packChecks,
        priceHistory: s.priceHistory,
        mercaditoA: s.mercaditoA, mercaditoB: s.mercaditoB,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { guardadas, changed } = migrateClaimsPerCategoria(state.categoriasGuardadas);
        if (changed) {
          state.categoriasGuardadas = guardadas;
          const activa = guardadas[state.categoria];
          if (activa && state.categoria !== "Detergente líquido" && looksLikeDetergentSeed(state.claims)) {
            state.claims = [];
          }
        }
        state.recalc();
      },
    },
  ),
);

export function autoMap(cols: string[]): Partial<Record<CanonicalField, string>> {
  const lc = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const find = (...keys: string[]) => cols.find((c) => keys.some((k) => lc(c).includes(k)));
  return {
    categoria: find("categ", "segmento categoria"),
    marca: find("marca", "brand", "fabricante"),
    descripcion: find("descrip", "producto", "sku", "articulo", "item", "nombre"),
    variedad: find("variedad", "aroma", "fragan", "sabor", "tipo"),
    empaque: find("empaq", "pack", "presenta", "envase", "material"),
    tamano: find("tama", "contenido", "gramaje", "capacidad", "size", "volumen unit", "ml", "litros", "gramos"),
    unidades: find("unidades vendid", "unidades", "cantidad", "qty", "vendid", "pzas", "piezas", "volumen unid"),
    pvp: find("pvp", "precio unit", "precio prom", "precio"),
    ventasValor: find("ventas valor", "venta valor", "valor venta", "importe", "monto", "facturac", "ventas $", "ventas usd"),
    periodo: find("period", "fecha", "mes", "año", "ano", "trimestre"),
    cadena: find("cadena", "autoserv", "canal", "local", "tienda", "retailer"),
    codigo: find("codigo", "cod ", "code", "ean", "sku ", "upc"),
  };
}

// Auto-load mock on first import if the store is empty
if (typeof window !== "undefined") {
  setTimeout(() => {
    const s = useGoldery.getState();
    if (s.rawRows.length === 0) s.loadMock();
    else s.recalc();
  }, 0);
}
