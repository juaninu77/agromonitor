import { getPendingItems, syncPendingItems } from "./offline-queue"

export interface ResultadoFinalizacion {
  totalSanidad?: number
  stock?: { descontado: number; faltante: number; unidad: string; ubicacion: string | null } | null
  /** Aviso de inventario (faltó stock o no se pudo calcular el descuento) */
  avisoStock?: string | null
}

export async function finalizeSession(sessionId: string): Promise<ResultadoFinalizacion> {
  if ((await getPendingItems(sessionId)).length > 0) {
    await syncPendingItems(sessionId)
    if ((await getPendingItems(sessionId)).length > 0) {
      throw new Error("Hay lecturas pendientes de sincronizar. Recuperá la conexión antes de finalizar.")
    }
  }
  const response = await fetch(`/api/manga/${sessionId}/finalizar`, { method: "POST" })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || "Error al finalizar la sesión")
  }
  const body = await response.json().catch(() => null)
  return (body?.data ?? {}) as ResultadoFinalizacion
}
