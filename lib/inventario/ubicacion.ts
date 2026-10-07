import { z } from "zod"

/**
 * Filtro de ubicación del inventario general: un galpón de los campos del
 * usuario o "sin-asignar" (movimientos históricos sin galpón). Devuelve el
 * `where` de MovimientoStock, o null si no se filtra.
 */
export function filtroUbicacion(valor: string | null, establecimientoIds: string[]) {
  if (!valor) return null
  if (valor === "sin-asignar") return { sectorId: null }
  const id = z.string().uuid().safeParse(valor)
  if (!id.success) return { id: { in: [] as string[] } }
  return { sectorId: id.data, sector: { establecimientoId: { in: establecimientoIds } } }
}
