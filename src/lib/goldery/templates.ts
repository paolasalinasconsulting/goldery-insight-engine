import type { ClaimRow } from "./types";

/** Plantillas de claims sugeridos por tipo de categoría.
 *  El match es por palabras clave sobre el nombre normalizado de la categoría. */
export interface ClaimTemplate {
  key: string;
  label: string;
  match: (nombreLower: string) => boolean;
  claims: string[];
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const CLAIM_TEMPLATES: ClaimTemplate[] = [
  {
    key: "detergente",
    label: "Detergentes (ropa)",
    match: (n) => /(deterg|jabon\s*de?\s*ropa|jabon\s*para\s*ropa|lavar\s*ropa)/.test(n),
    claims: [
      "Quita manchas difíciles",
      "Aroma duradero 24h",
      "Concentrado, rinde más",
      "Cuida los colores",
      "Rinde 60 lavadas",
      "Con bicarbonato",
      "Ideal para máquina y mano",
      "Biodegradable",
    ],
  },
  {
    key: "lavavajillas",
    label: "Lavavajillas",
    match: (n) => /(lavavaj|lava\s*vaj|lavaplat|lava\s*plat|vajill)/.test(n),
    claims: [
      "Arranca grasa",
      "Corta grasa en agua fría",
      "Rinde más (más lavados por envase)",
      "Suave con las manos",
      "Aroma agradable",
      "Espuma abundante",
      "Antibacterial",
    ],
  },
  {
    key: "suavizante",
    label: "Suavizantes",
    match: (n) => /(suaviz|acondicion.*ropa|enjuague)/.test(n),
    claims: [
      "Suavidad al tacto",
      "Aroma que perdura",
      "Facilita el planchado",
      "Menos electricidad estática",
      "Concentrado",
    ],
  },
  {
    key: "shampoo",
    label: "Shampoo / cuidado capilar",
    match: (n) => /(shampoo|champu|acondiciona.*cabello|cabello|capilar)/.test(n),
    claims: [
      "Anticaspa",
      "Reparación puntas",
      "Brillo y suavidad",
      "Sin sal",
      "Hidratación profunda",
      "Control caída",
    ],
  },
  {
    key: "limpieza-hogar",
    label: "Limpieza del hogar",
    match: (n) => /(desinfect|multiusos|multi\s*usos|limpiador|pisos|superficie|cloro|desengras)/.test(n),
    claims: [
      "Elimina 99.9% de gérmenes",
      "Sin necesidad de enjuagar",
      "Deja aroma fresco",
      "Cuida las superficies",
      "Corta grasa",
    ],
  },
  {
    key: "papel",
    label: "Papel higiénico / toallas",
    match: (n) => /(papel|higienico|toalla|servilleta)/.test(n),
    claims: [
      "Doble hoja",
      "Suave y resistente",
      "Rinde más metros",
      "Biodegradable",
      "Absorbe más",
    ],
  },
];

export function templateForCategoria(categoria: string): ClaimTemplate | undefined {
  const n = norm(categoria);
  return CLAIM_TEMPLATES.find((t) => t.match(n));
}

export function claimsFromNames(names: string[]): ClaimRow[] {
  return names.map((claim, i) => ({
    id: `c${Date.now()}_${i}`,
    claim,
    marcasUsan: "",
    loUsaLider: false,
    loTieneGoldery: "duda",
    goldery_puede: "duda",
    consumidor_entiende: "duda",
  }));
}
