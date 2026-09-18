import { z } from "zod"

export const especieFiltroSchema = z.enum(["bovino", "ovino", "todos"])
export type EspecieFiltro = z.infer<typeof especieFiltroSchema>
export const especieLabels: Record<EspecieFiltro, string> = {
  bovino: "Bovinos",
  ovino: "Ovinos",
  todos: "Todos",
}
export function leerEspecie(value: string | null): EspecieFiltro {
  const result = especieFiltroSchema.safeParse(value)
  return result.success ? result.data : "bovino"
}

export const ganadoPaginacionSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(25),
  orderDirection: z.enum(["asc", "desc"]).default("asc"),
  especie: especieFiltroSchema.optional(),
  estadoVital: z
    .enum(["activo", "vendido", "muerto", "baja", "todos"])
    .optional(),
})

export interface GanadoQuery {
  establecimientoId: string
  especie: EspecieFiltro
  busqueda?: string
  categoriaId?: string
  loteId?: string
  estadoVital?: string
  page?: number
  limit?: number
  orderBy?: string
  orderDirection?: "asc" | "desc"
}

export function ganadoParams(query: GanadoQuery): URLSearchParams {
  if (!query.establecimientoId)
    throw new Error("Seleccioná un campo para consultar ganado")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "")
      params.set(key, String(value).trim())
  }
  return params
}

// Recorre todas las páginas del mismo filtro; nunca exporta una página como si fuera el total.
export async function cargarTodosLosAnimales<T>(
  query: GanadoQuery,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page++) {
    const response = await fetch(
      `/api/ganado/bovinos?${ganadoParams({ ...query, page, limit: 100 })}`,
      { signal },
    )
    const result = await response.json()
    if (!response.ok || !result.success)
      throw new Error(result.error || "No se pudo completar la exportación")
    rows.push(...result.data)
    if (!result.pagination.hasNextPage) return rows
  }
}
