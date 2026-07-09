
# Diagnóstico Category IQ vs. especificación

Auditoría del código actual (rutas, `lib/goldery/*`, store, componentes) frente a los 4 módulos de la spec + criterios generales.

---

## MÓDULO 1 — Base de Datos y Volumen

| Requisito | Estado | Detalle |
|---|---|---|
| Campos: Categoría, Marca, Variedad/Aroma, Presentación (n° + unidad), Unidades vendidas mensuales | **Parcial** | Existen Categoría, Marca, Descripción, Empaque, Tamaño (ml), Unidades, PVP. **Falta un campo explícito de Variedad/Aroma** (hoy se mezcla dentro de "descripción"). |
| Marcar marca como "Mi Marca" y otra como "Líder" | **Parcial** | Existe `marcasPropias` en Settings pero **no hay override manual de "Líder"** — el líder se infiere siempre como el de mayor volumen. Debe poder fijarse manualmente. |
| Volumen Total automático (Unid × Presentación) normalizado a una unidad | **Cumple** | `normalizeRows` calcula `volumenMl = unidades * tamanoMl` y `parseSize` normaliza L→ml, kg→g, oz→ml. |
| Agrupación lógica de tamaño (900/1000/1100 → ~1000) con rangos editables | **Cumple parcial** | `DEFAULT_SEGMENTS` + `Configuracion` permite editar rangos min/max/label. Falta un botón "agrupación automática" que sugiera clusters desde la data real. |
| Importación CSV/Excel **y entrada manual** | **Parcial** | Solo Excel/CSV upload. **No hay editor manual** de filas (agregar SKU manualmente, editar unidades, etc.). |
| Persistencia por categoría | **No cumple** | Todo vive en Zustand en memoria — se pierde al recargar y no hay separación por categoría (una sola categoría activa a la vez). |

## MÓDULO 2 — Share

| Requisito | Estado | Detalle |
|---|---|---|
| **Todos los shares sobre volumen, nunca sobre unidades** | **No cumple estricto** | La tabla de `/share` muestra "share vol", "share unid" y "share valor". El KPI del dashboard usa volumen ✅, pero la spec exige que **share unid/valor no se presenten como share** (o queden como métricas secundarias claramente etiquetadas). Además `paretoSkus` **sí usa volumen ✅**. |
| Share Total de Categoría (dona o barras) | **Parcial** | Hay barras. **Falta variante dona** opcional. |
| Share por Agrupación de Tamaño / Pareto (barras apiladas) | **No cumple** | No existe gráfico de barras apiladas de share por segmento × marca. |
| Share por Variedad/Aroma | **No cumple** | No existe porque no hay campo variedad. |
| "Mi Marca" resaltada | **Cumple** | Color distintivo en charts y tabla. |
| Filtro global por categoría | **No cumple** | Una sola categoría activa; no hay selector global. |

## MÓDULO 3 — Precios

| Requisito | Estado | Detalle |
|---|---|---|
| Emparejamiento Líder vs Mi Marca por agrupación, **ajustable manualmente** | **No cumple** | Se auto-empareja con el líder del segmento; no hay UI para elegir "contra qué SKU/marca comparar" por segmento. |
| Precio/ml = PVP ÷ Presentación | **Cumple** | `precioPorMl = pvp / tamanoMl`. |
| Índice = (P/ml Mi Marca ÷ P/ml Líder) × 100 | **Cumple** | Correcto en `analyzeSegments`. |
| Semáforo: verde <100, rojo >100 | **No cumple estricto** | El semáforo actual usa 5 niveles (muy barato/valor/paridad/moderado/alto). La spec pide binario verde/rojo con corte en 100. |
| Independiente del módulo de share | **Parcial** | Reutiliza `analyzeSegments` (que también calcula share). Debería tener su propia tabla que **no dependa de que Goldery esté presente en el segmento** — hoy se marca "sin SKU". |

## MÓDULO 4 — Claims

| Requisito | Estado | Detalle |
|---|---|---|
| Campos: Claim, Marca que lo comunica, ¿Lo tengo?, ¿Puedo decirlo? (si "Lo tengo"=No), ¿Lo entienden? (si "Lo tengo"=Sí) | **Parcial** | Existen los 4 flags pero se muestran **siempre todos** — no hay lógica condicional (mostrar "Puedo decirlo" solo si no lo tengo; "Lo entienden" solo si sí lo tengo). |
| Colores verde=Sí, rojo=No, amarillo=Duda | **No cumple** | Hoy son checkboxes simples. Falta tri-estado Sí/No/Duda con color. |
| Resumen: claims que tengo, oportunidades me-too, claims con problema de comprensión | **Parcial** | Existe "prioridad alta" pero **no 3 contadores explícitos** (tengo / me-too / no entienden). |

## GENERAL

| Requisito | Estado |
|---|---|
| Multi-categoría con lógica idéntica | **No cumple** — una sola categoría activa. |
| Dashboard inicial con resumen por categoría | **No cumple** — el dashboard muestra la categoría activa, no un resumen multi-categoría. |
| Exportación Excel/CSV **por módulo** | **Parcial** — un solo XLSX combinado. Falta un botón por módulo. |
| Español, responsive, validaciones amigables (sin volúmenes negativos, alerta si falta PVP) | **Parcial** — español ✅. Validaciones: `normalizeRows` filtra silenciosamente unidades ≤ 0 y no alerta por PVP faltante. |

---

# Plan de corrección (por prioridad)

## Módulo 1 (base + persistencia + multi-categoría) — máxima prioridad
1. Añadir campo canónico **`variedad`** en `types.ts`, mapping automático, columna en Base normalizada y mock.
2. Persistir el store con **`zustand/middleware/persist`** en `localStorage`, keyed por categoría (`categorias: Record<string, DatasetCategoria>`), con selector de categoría activa.
3. Selector global de **categoría activa** en el header (junto con periodo/cadena).
4. En Configuración, permitir marcar manualmente **Marca Líder** por categoría (`liderManual?: string`); si se define, se usa en vez del top-vol.
5. Nueva pestaña **"Entrada manual"** dentro de `/upload` (o página `/manual`) con tabla editable (agregar/editar/eliminar filas) que alimenta `rawRows`.
6. Validaciones amigables: mostrar filas descartadas con motivo (unidades≤0, sin marca, sin tamaño, sin PVP → warning no bloqueante).
7. Botón "Sugerir agrupación automática" en Configuración: hace clustering k-means simple sobre tamaños reales y propone rangos.

## Módulo 2 (share sobre volumen + gráficos faltantes)
8. Etiquetar claramente en `/share` que **la métrica principal es share de VOLUMEN**; degradar unid/valor a columnas secundarias con nota "referencia".
9. Añadir **gráfico dona** de share por marca junto al de barras.
10. Nuevo gráfico **barras apiladas** de share por segmento × marca (Mi marca resaltada).
11. Nueva sección **Share por Variedad/Aroma** (barras) usando el nuevo campo `variedad`.
12. Selector global de categoría propaga a todos los cálculos.

## Módulo 3 (precios independientes + semáforo binario + emparejamiento manual)
13. Refactor `/precios` para que sea **independiente de `analyzeSegments`**: tabla propia con precio/ml promedio por marca × segmento.
14. UI por segmento: dropdown "Comparar contra:" (default = marca con mayor share del segmento, editable). Guardar `comparacionesPrecio: Record<segmento, marcaLider>` en el store.
15. Semáforo binario **verde <100 / rojo >100** (mantener los matices de 5 niveles como texto de detalle, pero el chip color = binario).
16. Alerta amarilla si Mi Marca no tiene PVP en un segmento donde sí compite.

## Módulo 4 (claims con lógica condicional + tri-estado + resumen)
17. Cambiar checkbox binarios por **select tri-estado Sí/No/Duda** en los campos `loTieneGoldery`, `goldery_puede`, `consumidor_entiende`. Colores verde/rojo/amarillo con tokens semánticos.
18. Lógica condicional: si `loTieneGoldery = Sí`, ocultar "Puedo decirlo"; si = No, ocultar "Lo entienden".
19. Añadir barra superior con **3 KPIs**: Claims que tengo · Oportunidades Me-Too · Claims con problema de comprensión.

## General (al final)
20. En `/exportar`, añadir **un botón por módulo** (Base, Share, Pareto, Segmentos, Precios, Claims) + el combinado.
21. Verificar responsive (sidebar colapsable en móvil ya existe? — auditar y ajustar si falta).

---

## Nota técnica
- Todos los cálculos siguen viviendo en `src/lib/goldery/calc.ts`. Se añadirán `priceMatrix(data, comparaciones)` y `varietyShare(data)` como nuevas funciones puras.
- La persistencia usa `persist` de Zustand con storage `localStorage`, versión 1 (migración a v2 si en el futuro se agrega Cloud).
- **No** se activa Lovable Cloud en este paso — la persistencia local cubre el requisito "los datos persisten". Si más adelante piden multi-usuario o compartir análisis, se migra a Cloud.
