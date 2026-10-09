// Descarga completa del rodeo desde el cliente: la API pagina con un máximo de 1000
// animales por página, así que se recorren todas las páginas.

const POR_PAGINA = 1000
const MAX_PAGINAS = 50

/** Todos los bovinos que devuelve `/api/ganado/bovinos` con esos filtros (todas las páginas). */
export async function traerTodosLosAnimales<T = Record<string, unknown>>(filtros: Record<string, string>): Promise<T[]> {
  const todos: T[] = []
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const qs = new URLSearchParams({ ...filtros, page: String(page), limit: String(POR_PAGINA) })
    const res = await fetch(`/api/ganado/bovinos?${qs}`)
    if (!res.ok) throw new Error("No se pudo descargar el rodeo")
    const json = await res.json()
    const data: T[] = json.data ?? []
    todos.push(...data)
    const totalPages = json.pagination?.totalPages ?? 1
    if (page >= totalPages || data.length < POR_PAGINA) break
  }
  return todos
}
