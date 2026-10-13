// Cola sin conexión de la manga: cada «Confirmar y Siguiente» cargado sin señal queda en
// este dispositivo (IndexedDB) y se envía al volver la conexión. Cada lectura lleva una
// clave generada acá: el servidor no la registra dos veces si un envío se repite. Si el
// servidor la rechaza (por ejemplo, el RFID ya se dio de alta desde otro equipo) queda
// «para revisar»: reintentar, guardarla como lectura o descartarla. Nunca se pierde en
// silencio ni bloquea para siempre la sesión.

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
  /** Alta de un EID nuevo: ids del catálogo */
  especieId?: string | null
  razaId?: string | null
  categoriaId?: string | null
  createdAt: string
  /** Clave de la lectura (la genera el dispositivo; hace idempotente el envío) */
  clave?: string
  /** Sin estado = pendiente (lecturas guardadas antes de esta versión) */
  estado?: EstadoPendiente
  /** Motivo del rechazo, o del último intento fallido */
  error?: string
  intentos?: number
}

export type EstadoPendiente = "pendiente" | "conflicto"
export const esConflicto = (item: Pick<PendingItem, "estado">) => item.estado === "conflicto"

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
  const nuevo: Omit<PendingItem, "id"> = { ...item, clave: item.clave ?? crypto.randomUUID(), estado: "pendiente", intentos: 0 }
  return await withPendingStore("readwrite", (store) => store.add(nuevo)) as number
}

/** Guarda los cambios de una lectura ya encolada (estado, error, intentos). */
export async function updatePendingItem(item: PendingItem): Promise<void> {
  if (item.id == null) throw new Error("Lectura sin id")
  await withPendingStore("readwrite", (store) => store.put(item))
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

export interface ResultadoSync {
  synced: number
  /** Siguen pendientes (sin conexión o error del servidor: se reintentan solas) */
  pendientes: number
  /** Rechazadas por el servidor: necesitan que alguien las revise */
  conflictos: number
  sinConexion: boolean
}

/** Qué hacer con la respuesta del servidor a una lectura. */
export function clasificarRespuesta(status: number): "enviada" | "reintentar" | "conflicto" {
  if (status >= 200 && status < 300) return "enviada"
  // Sesión vencida, demasiados pedidos o error del servidor: se reintenta más tarde
  if (status === 401 || status === 408 || status === 429 || status >= 500) return "reintentar"
  return "conflicto"
}

/** Cuerpo que se envía al servidor (sin los datos propios de la cola). */
export function cuerpoDeLectura(item: PendingItem) {
  return {
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
    especieId: item.especieId,
    razaId: item.razaId,
    categoriaId: item.categoriaId,
    clave: item.clave,
  }
}

const esErrorDeRed = (e: unknown) => e instanceof TypeError || (e instanceof DOMException && e.name === "AbortError")

interface DependenciasSync {
  enviar: (item: PendingItem) => Promise<Response>
  guardar: (item: PendingItem) => Promise<void>
  borrar: (id: number) => Promise<void>
}

/**
 * Envía las lecturas en el orden en que se cargaron. Un rechazo de datos (4xx) pasa a
 * «para revisar» y se sigue con la siguiente; un corte de red o un error del servidor
 * detiene el envío (se reintenta después). Las que ya están para revisar no se reenvían.
 */
export async function procesarCola(items: PendingItem[], dep: DependenciasSync): Promise<ResultadoSync> {
  const res: ResultadoSync = { synced: 0, pendientes: 0, conflictos: 0, sinConexion: false }
  let detenida = false
  for (const item of items) {
    if (esConflicto(item)) { res.conflictos++; continue }
    if (detenida || item.id == null) { res.pendientes++; continue }
    const intentos = (item.intentos ?? 0) + 1
    let r: Response
    try {
      r = await dep.enviar(item)
    } catch (e) {
      if (!esErrorDeRed(e)) throw e
      detenida = true; res.sinConexion = true; res.pendientes++
      continue
    }
    const destino = clasificarRespuesta(r.status)
    if (destino === "enviada") { await dep.borrar(item.id); res.synced++; continue }
    const body = await r.json().catch(() => null) as { error?: string } | null
    if (destino === "reintentar") {
      await dep.guardar({ ...item, intentos, error: r.status === 401 ? "Iniciá sesión de nuevo para enviar" : body?.error ?? `Error del servidor (${r.status})` })
      detenida = true; res.pendientes++
      continue
    }
    await dep.guardar({ ...item, estado: "conflicto", intentos, error: body?.error ?? `Rechazada por el sistema (${r.status})` })
    res.conflictos++
  }
  return res
}

const syncInFlight = new Map<string, Promise<ResultadoSync>>()

export function syncPendingItems(sessionId: string): Promise<ResultadoSync> {
  const current = syncInFlight.get(sessionId)
  if (current) return current
  const pending = syncSessionItems(sessionId).finally(() => syncInFlight.delete(sessionId))
  syncInFlight.set(sessionId, pending)
  return pending
}

async function syncSessionItems(sessionId: string): Promise<ResultadoSync> {
  const items = (await getPendingItems(sessionId)).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  return procesarCola(items, {
    enviar: (item) => fetch(`/api/manga/${item.sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeLectura(item)),
    }),
    guardar: updatePendingItem,
    borrar: removePendingItem,
  })
}

/** Vuelve a enviar una lectura rechazada (por ejemplo, después de corregir el dato en otro lado). */
export async function reintentarPendiente(item: PendingItem): Promise<void> {
  await updatePendingItem({ ...item, estado: "pendiente", error: undefined })
}

/**
 * Convierte una lectura rechazada en una lectura simple: sin alta ni animal elegido. El
 * servidor la vincula con el animal que tenga ese EID en el campo (si lo hay), así un alta
 * repetida desde otro equipo no pierde el peso ni el resto de lo cargado.
 */
export function comoLectura(item: PendingItem): PendingItem {
  return {
    ...item,
    estado: "pendiente",
    error: undefined,
    esNuevoRegistro: false,
    animalId: null,
    caravanaVisual: null,
    sexo: null,
    categoria: null,
    especieId: null,
    razaId: null,
    categoriaId: null,
  }
}

/** Qué contiene una lectura, para mostrarla en la revisión: «Alta · 320 kg · tratamiento». */
export function resumenLectura(item: PendingItem): string {
  const partes: string[] = []
  if (item.esNuevoRegistro) partes.push(`Alta${item.caravanaVisual ? ` ${item.caravanaVisual}` : ""}`)
  if (item.pesoKg != null) partes.push(`${item.pesoKg.toLocaleString("es-AR")} kg`)
  if (item.cc != null) partes.push(`CC ${item.cc}`)
  if (item.resultadoTacto) partes.push(`tacto ${item.resultadoTacto}`)
  if (item.accionSanidad) partes.push("tratamiento")
  if (item.denticion) partes.push(`dentición ${item.denticion}`)
  if (item.apartadoA) partes.push(`apartado a ${item.apartadoA}`)
  return partes.join(" · ") || "Lectura"
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
