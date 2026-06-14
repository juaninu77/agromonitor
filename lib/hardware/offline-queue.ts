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

export async function addPendingItem(item: Omit<PendingItem, "id">): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(item)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingItems(sessionId?: string): Promise<PendingItem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)

    if (sessionId) {
      const index = store.index("sessionId")
      const request = index.getAll(sessionId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }
  })
}

export async function removePendingItem(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
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
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function syncPendingItems(sessionId: string): Promise<{ synced: number; failed: number }> {
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
