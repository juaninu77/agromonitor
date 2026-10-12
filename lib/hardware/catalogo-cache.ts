// Catálogo de especies, razas y categorías para dar de alta EIDs nuevos en la manga, también sin
// señal: se baja con conexión y se guarda en el dispositivo (localStorage, por campo).

export interface CatalogoManga {
  especies: { id: string; nombre: string }[]
  razas: { id: string; nombre: string; especieId: string }[]
  categorias: { id: string; nombre: string; especieId: string; sexo: string | null; edadMinMeses?: number | null }[]
}

const clave = (establecimientoId: string) => `agromonitor-manga-catalogo:${establecimientoId}`
const VACIO: CatalogoManga = { especies: [], razas: [], categorias: [] }

function leer(establecimientoId: string): CatalogoManga | null {
  try {
    const raw = localStorage.getItem(clave(establecimientoId))
    return raw ? (JSON.parse(raw) as CatalogoManga) : null
  } catch {
    return null
  }
}

async function datos<T>(url: string): Promise<T[]> {
  const r = await fetch(url)
  if (!r.ok) throw new Error("catálogo")
  const b = await r.json()
  return (Array.isArray(b) ? b : b.data ?? []) as T[]
}

/** Catálogo del campo: el del servidor si hay conexión (y lo guarda), si no el guardado. */
export async function cargarCatalogoManga(establecimientoId: string): Promise<CatalogoManga> {
  const guardado = leer(establecimientoId)
  if (typeof navigator !== "undefined" && !navigator.onLine) return guardado ?? VACIO
  try {
    const [especies, razas, categorias] = await Promise.all([
      datos<CatalogoManga["especies"][number]>("/api/especies"),
      datos<CatalogoManga["razas"][number]>("/api/razas"),
      datos<CatalogoManga["categorias"][number]>("/api/categorias"),
    ])
    const catalogo: CatalogoManga = {
      especies: especies.map(({ id, nombre }) => ({ id, nombre })),
      razas: razas.map(({ id, nombre, especieId }) => ({ id, nombre, especieId })),
      categorias: categorias.map(({ id, nombre, especieId, sexo, edadMinMeses }) => ({ id, nombre, especieId, sexo: sexo ?? null, edadMinMeses: edadMinMeses ?? null })),
    }
    try { localStorage.setItem(clave(establecimientoId), JSON.stringify(catalogo)) } catch { /* sin espacio: sigue sin caché */ }
    return catalogo
  } catch {
    return guardado ?? VACIO
  }
}

/** Especie por defecto del alta: la del lote de origen, si no «bovino», si no la única. */
export function especiePorDefecto(catalogo: CatalogoManga, especieDelLote?: string | null): string {
  if (especieDelLote && catalogo.especies.some((e) => e.id === especieDelLote)) return especieDelLote
  return catalogo.especies.find((e) => e.nombre.toLowerCase() === "bovino")?.id ?? (catalogo.especies.length === 1 ? catalogo.especies[0].id : "")
}

/** Categorías válidas para la especie y el sexo elegidos (las sin sexo valen para ambos). */
export function categoriasPara(catalogo: CatalogoManga, especieId: string, sexo: string) {
  return catalogo.categorias
    .filter((c) => c.especieId === especieId && (!c.sexo || !sexo || c.sexo === sexo))
    .sort((a, b) => (a.edadMinMeses ?? 0) - (b.edadMinMeses ?? 0) || a.nombre.localeCompare(b.nombre))
}
