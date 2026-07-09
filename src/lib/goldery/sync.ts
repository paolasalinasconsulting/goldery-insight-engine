import { supabase } from "@/integrations/supabase/client";
import { useGoldery, migrateClaimsPerCategoria } from "./store";

/** Extrae el snapshot persistible del store (mismo shape que `partialize`). */
export function snapshot() {
  const s = useGoldery.getState();
  return {
    categoria: s.categoria,
    categorias: s.categorias,
    categoriasGuardadas: s.categoriasGuardadas,
    periodo: s.periodo, cadena: s.cadena, pais: s.pais, fileName: s.fileName,
    rawRows: s.rawRows, rawColumns: s.rawColumns, mapping: s.mapping,
    settings: s.settings, claims: s.claims, packChecks: s.packChecks,
    priceHistory: s.priceHistory,
    mercaditoA: s.mercaditoA, mercaditoB: s.mercaditoB,
  };
}

/** Aplica un snapshot al store y recalcula la vista activa.
 *  Ejecuta la misma migración de claims por categoría que `onRehydrateStorage`,
 *  para que un backup en la nube con claims sembrados por error se limpie al cargar. */
export function applySnapshot(payload: any) {
  if (!payload || typeof payload !== "object") return;
  const guardadasIn = (payload.categoriasGuardadas ?? {}) as Record<string, any>;
  const { guardadas, changed } = migrateClaimsPerCategoria(guardadasIn);
  const activaCat = payload.categoria as string | undefined;
  let activaClaims = payload.claims;
  if (changed && activaCat && activaCat !== "Detergente líquido") {
    // Si la categoría activa venía con el seed, reemplaza también la vista proyectada
    const activaSnap = guardadas[activaCat];
    if (activaSnap) activaClaims = activaSnap.claims;
  }
  useGoldery.setState({ ...payload, categoriasGuardadas: guardadas, claims: activaClaims } as any);
  useGoldery.getState().recalc();
}

/** Descarga los datos del usuario desde Supabase y los aplica al store. */
export async function pullFromCloud(userId: string): Promise<"loaded" | "empty" | "error"> {
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return "error";
    if (!data || !data.data || Object.keys(data.data as any).length === 0) return "empty";
    applySnapshot(data.data);
    return "loaded";
  } catch { return "error"; }
}

/** Guarda el snapshot actual en Supabase (upsert por user_id). */
export async function pushToCloud(userId: string) {
  const payload = snapshot();
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, data: payload as any }, { onConflict: "user_id" });
  if (error) console.error("[sync] pushToCloud", error);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

/** Suscribe cambios del store y los persiste en la nube con debounce. */
export function startAutoSync(userId: string) {
  stopAutoSync();
  unsubscribe = useGoldery.subscribe(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { void pushToCloud(userId); }, 1500);
  });
}

export function stopAutoSync() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
}
