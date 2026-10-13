import { esConflicto, getPendingItems, syncPendingItems } from "./offline-queue"

export interface ResultadoFinalizacion {
  totalSanidad?: number
  /** Animales marcados con tratamiento que ya no están activos en el campo (no se registran) */
  sanidadOmitidos?: number
  stock?: { descontado: number; faltante: number; unidad: string; ubicacion: string | null } | null
  /** Aviso de inventario (faltó stock o no se pudo calcular el descuento) */
  avisoStock?: string | null
}

export async function finalizeSession(sessionId: string): Promise<ResultadoFinalizacion> {
  let locales = await getPendingItems(sessionId)
  if (locales.some((i) => !esConflicto(i))) {
    await syncPendingItems(sessionId)
    locales = await getPendingItems(sessionId)
  }
  if (locales.some((i) => !esConflicto(i))) {
    throw new Error("Hay lecturas pendientes de sincronizar. Recuperá la conexión antes de finalizar.")
  }
  const rechazadas = locales.length
  if (rechazadas > 0) {
    throw new Error(
      `${rechazadas === 1 ? "Hay 1 lectura rechazada" : `Hay ${rechazadas} lecturas rechazadas`} por el sistema. ` +
      `${rechazadas === 1 ? "Revisala" : "Revisalas"} en «Para revisar» (reintentar, guardar como lectura o descartar) antes de finalizar.`,
    )
  }
  const response = await fetch(`/api/manga/${sessionId}/finalizar`, { method: "POST" })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || "Error al finalizar la sesión")
  }
  const body = await response.json().catch(() => null)
  return (body?.data ?? {}) as ResultadoFinalizacion
}
