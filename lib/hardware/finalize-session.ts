import { getPendingItems, syncPendingItems } from "./offline-queue"

export async function finalizeSession(sessionId: string): Promise<void> {
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
}
