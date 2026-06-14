// Caché local del rodeo en IndexedDB para búsqueda offline por EID.
// Patrón idéntico a offline-queue.ts: abre la BD una sola vez por llamada.
// Usa normalizeEID de lib/hardware/eid.ts para normalizar antes de guardar y buscar.

import { normalizeEID } from "./eid"

const DB_NAME = "agromonitor-manga"
const DB_VERSION = 2
const HERD_STORE = "herd"
const PENDING_STORE = "pending-items"

export interface CachedAnimal {
  eid: string
  establecimientoId: string
  id?: string
  caravanaVisual?: string | null
  caravanaRfid?: string | null
  sexo?: string | null
  nombre?: string | null
  raza?: string | null
  categoria?: string | null
  pesoActual?: number | null
  ccActual?: number | null
  lote?: string | null
  ubicacion?: string | null
  [key: string]: unknown
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, {
          keyPath: "id",
          autoIncrement: true,
        })
        store.createIndex("sessionId", "sessionId", { unique: false })
      }

      if (!db.objectStoreNames.contains(HERD_STORE)) {
        const store = db.createObjectStore(HERD_STORE, { keyPath: "eid" })
        store.createIndex("establecimientoId", "establecimientoId", {
          unique: false,
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Guarda (reemplaza) el rodeo completo de un establecimiento en IndexedDB.
 * Normaliza cada EID antes de guardar para que la búsqueda sea consistente.
 */
export async function saveHerd(
  establecimientoId: string,
  animales: Record<string, unknown>[]
): Promise<number> {
  const db = await openDB()

  // Primero limpiamos los animales previos de ese establecimiento
  await clearHerdByEstablecimiento(db, establecimientoId)

  const tx = db.transaction(HERD_STORE, "readwrite")
  const store = tx.objectStore(HERD_STORE)
  let saved = 0

  for (const animal of animales) {
    const rawEid =
      (animal.caravanaRfid as string) ||
      (animal.cuig as string) ||
      (animal.eid as string) ||
      ""
    const eid = normalizeEID(rawEid)
    if (!eid) continue

    const entry: CachedAnimal = {
      eid,
      establecimientoId,
      id: animal.id as string | undefined,
      caravanaVisual: (animal.caravanaVisual as string) ?? null,
      caravanaRfid: (animal.caravanaRfid as string) ?? null,
      sexo: (animal.sexo as string) ?? null,
      nombre: (animal.nombre as string) ?? null,
      raza:
        (animal.breed as string) ??
        ((animal.raza as { nombre?: string })?.nombre as string) ??
        null,
      categoria:
        (animal.category as string) ??
        ((animal.categoria as { nombre?: string })?.nombre as string) ??
        null,
      pesoActual: (animal.pesoActual as number) ?? (animal.weight as number) ?? null,
      ccActual: (animal.ccActual as number) ?? (animal.bodyConditionScore as number) ?? null,
      lote: (animal.lote as string) ?? null,
      ubicacion: (animal.ubicacion as string) ?? (animal.location as string) ?? null,
    }

    store.put(entry)
    saved++
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(saved)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Busca un animal en la caché por EID. Normaliza el EID antes de buscar.
 */
export async function findAnimalByEID(
  rawEid: string
): Promise<CachedAnimal | null> {
  const eid = normalizeEID(rawEid)
  if (!eid) return null

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HERD_STORE, "readonly")
    const store = tx.objectStore(HERD_STORE)
    const request = store.get(eid)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Devuelve la cantidad de animales cacheados para un establecimiento.
 */
export async function getHerdCount(
  establecimientoId: string
): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HERD_STORE, "readonly")
    const store = tx.objectStore(HERD_STORE)
    const index = store.index("establecimientoId")
    const request = index.count(establecimientoId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function clearHerdByEstablecimiento(
  db: IDBDatabase,
  establecimientoId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HERD_STORE, "readwrite")
    const store = tx.objectStore(HERD_STORE)
    const index = store.index("establecimientoId")
    const request = index.openCursor(establecimientoId)

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
