const DB_NAME = "agromonitor-manga"
const DB_VERSION = 2
const STORE_NAME = "pending-items"

export interface PendingItem {
  id?: number
  sessionId: string
  eidLeido: string
  pesoKg?: number | null
  cc?: number | null
  denticion?: string | null
  resultadoTacto?: string | null
  mesesGestacion?: number | null
  accionSanidad?: boolean
  apartadoA?: string | null
  observaciones?: string | null
  animalId?: string | null
  esNuevoRegistro?: boolean
  caravanaVisual?: string | null
  sexo?: string | null
  categoria?: string | null
  createdAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
        store.createIndex("sessionId", "sessionId", { unique: false })
      }
      if (!db.objectStoreNames.contains("herd")) {
        const herdStore = db.createObjectStore("herd", { keyPath: "eid" })
        herdStore.createIndex("establecimientoId", "establecimientoId", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withPendingStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, mode)
      const request = operation(tx.objectStore(STORE_NAME))
      tx.oncomplete = () => { db.close(); resolve(request.result) }
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error("No se pudo guardar la operación local")) }
      tx.onerror = () => { db.close(); reject(tx.error ?? request.error) }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

export async function addPendingItem(item: Omit<PendingItem, "id">): Promise<number> {
  return await withPendingStore("readwrite", (store) => store.add(item)) as number
}

export function getPendingItems(sessionId?: string): Promise<PendingItem[]> {
  return withPendingStore("readonly", (store) =>
    sessionId ? store.index("sessionId").getAll(sessionId) : store.getAll()
  )
}

export async function removePendingItem(id: number): Promise<void> {
  await withPendingStore("readwrite", (store) => store.delete(id))
}

export async function clearPendingItems(sessionId: string): Promise<void> {
  const items = await getPendingItems(sessionId)
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, "readwrite")
  const store = tx.objectStore(STORE_NAME)
  for (const item of items) {
    if (item.id != null) store.delete(item.id)
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Transacción cancelada")) }
  })
}

export function getPendingCount(): Promise<number> {
  return withPendingStore("readonly", (store) => store.count())
}

const syncInFlight = new Map<string, Promise<{ synced: number; failed: number }>>()

export function syncPendingItems(sessionId: string): Promise<{ synced: number; failed: number }> {
  const current = syncInFlight.get(sessionId)
  if (current) return current
  const pending = syncSessionItems(sessionId).finally(() => syncInFlight.delete(sessionId))
  syncInFlight.set(sessionId, pending)
  return pending
}

async function syncSessionItems(sessionId: string): Promise<{ synced: number; failed: number }> {
  const items = await getPendingItems(sessionId)
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      const res = await fetch(`/api/manga/${item.sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eidLeido: item.eidLeido,
          pesoKg: item.pesoKg,
          cc: item.cc,
          denticion: item.denticion,
          resultadoTacto: item.resultadoTacto,
          mesesGestacion: item.mesesGestacion,
          accionSanidad: item.accionSanidad,
          apartadoA: item.apartadoA,
          observaciones: item.observaciones,
          animalId: item.animalId,
          esNuevoRegistro: item.esNuevoRegistro,
          caravanaVisual: item.caravanaVisual,
          sexo: item.sexo,
          categoria: item.categoria,
        }),
      })

      if (res.ok && item.id != null) {
        await removePendingItem(item.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

export function onOnlineChange(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}
