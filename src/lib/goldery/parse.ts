// Normaliza strings de tamaño: "1 800 ml", "1800ml", "1.8L", "5 L", "20 000 ml", "500 gr"
export function parseSize(raw: unknown): { ml: number; unidad: "ml" | "g" | "u" } {
  if (raw == null) return { ml: 0, unidad: "u" };
  if (typeof raw === "number") return { ml: raw, unidad: "ml" };
  let s = String(raw).toLowerCase().trim();
  s = s.replace(/\u00a0/g, " ").replace(/,/g, ".");
  // collapse spaces inside numbers: "1 800" -> "1800"
  s = s.replace(/(\d)\s+(?=\d{3}(\D|$))/g, "$1");
  const m = s.match(/([\d.]+)\s*(ml|cc|l|lt|lts|litros?|kg|kgs|g|gr|grs|gramos?|oz)?/);
  if (!m) return { ml: 0, unidad: "u" };
  const n = parseFloat(m[1]);
  const u = (m[2] || "ml").toLowerCase();
  if (["l", "lt", "lts", "litro", "litros"].includes(u)) return { ml: n * 1000, unidad: "ml" };
  if (["kg", "kgs"].includes(u)) return { ml: n * 1000, unidad: "g" };
  if (["g", "gr", "grs", "gramo", "gramos"].includes(u)) return { ml: n, unidad: "g" };
  if (u === "oz") return { ml: n * 29.5735, unidad: "ml" };
  return { ml: n, unidad: "ml" };
}

export function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^0-9.\-,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

export function normalizeBrand(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}
