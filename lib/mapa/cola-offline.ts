// Cola sin conexión del mapa: movimientos de animales, registros de actividad y
// mediciones de pasto que se cargan en el campo sin señal. Se guardan en este
// dispositivo (IndexedDB) y se envían solos al volver la conexión, en orden.
// Cada operación lleva una clave generada aquí, así un reenvío no la duplica.
// Si el servidor la rechaza (por ejemplo, los animales ya se movieron desde otro
// dispositivo) queda como conflicto para revisarla: reintentar o descartar.

export interface OperacionPendiente {
  clave: string
  url: string
  body: Record<string, unknown>
  /** Qué es, para mostrarlo: "Mover 3 animales a Potrero Sur" */
  etiqueta: string
  establecimientoId: string
  creadaAt: string
  estado: "pendiente" | "conflicto"
  error?: string
  intentos: number
}

export interface ColaStore {
  listar(): Promise<OperacionPendiente[]>
  guardar(op: OperacionPendiente): Promise<void>
  borrar(clave: string): Promise<void>
}

/** Rutas que se pueden encolar (todas aceptan `clave` y son idempotentes). */
export function esEncolable(url: string) {
  return url === "/api/mapa/movimientos" || /^\/api\/sectores\/[0-9a-f-]{36}\/(ficha|mediciones)$/.test(url)
}

export const EVENTO_COLA = "agromonitor:cola-mapa"
const avisar = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_COLA)) }

// ------------------------------------------------------------
// IndexedDB
// ------------------------------------------------------------

const DB = "agromonitor-mapa", STORE = "operaciones"

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "clave" }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function conStore<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo), req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("No se pudo guardar en este dispositivo")) }
  })
}

export const colaIndexedDB: ColaStore = {
  async listar() {
    const ops = await conStore<OperacionPendiente[]>("readonly", (s) => s.getAll())
    return ops.sort((a, b) => a.creadaAt.localeCompare(b.creadaAt))
  },
  async guardar(op) { await conStore("readwrite", (s) => s.put(op)); avisar() },
  async borrar(clave) { await conStore("readwrite", (s) => s.delete(clave)); avisar() },
}

// ------------------------------------------------------------
// Envío y sincronización
// ------------------------------------------------------------

type Fetch = (url: string, init: RequestInit) => Promise<Response>
const enviar = (f: Fetch, op: Pick<OperacionPendiente, "url" | "body">) =>
  f(op.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op.body) })

/** Sin respuesta del servidor (sin señal, DNS, corte): se puede reintentar más tarde. */
const esErrorDeRed = (e: unknown) => e instanceof TypeError || (e instanceof DOMException && e.name === "AbortError")

export type ResultadoEnvio = { estado: "enviada"; data: unknown } | { estado: "encolada" } | { estado: "error"; error: string }

/**
 * Envía ya si hay conexión; si no hay (o la red falla), la deja en la cola.
 * Un rechazo del servidor (validación, permisos, conflicto) se informa en el momento y no se encola.
 */
export async function enviarOEncolar(
  op: Omit<OperacionPendiente, "creadaAt" | "estado" | "intentos">,
  { store = colaIndexedDB, fetchFn = fetch as Fetch, online = typeof navigator === "undefined" ? true : navigator.onLine } = {},
): Promise<ResultadoEnvio> {
  const encolar = async () => { await store.guardar({ ...op, creadaAt: new Date().toISOString(), estado: "pendiente", intentos: 0 }); return { estado: "encolada" } as const }
  if (!online) return encolar()
  try {
    const r = await enviar(fetchFn, op)
    const b = await r.json().catch(() => ({}))
    if (r.ok) return { estado: "enviada", data: b.data }
    if (r.status >= 500) return encolar()
    return { estado: "error", error: b.error ?? "No se pudo guardar" }
  } catch (e) {
    if (esErrorDeRed(e)) return encolar()
    throw e
  }
}

export interface ResultadoSync { enviadas: number; conflictos: number; pendientes: number; sinConexion: boolean }

let sincronizando: Promise<ResultadoSync> | null = null

/**
 * Envía las pendientes en el orden en que se cargaron. Se detiene ante un error
 * de red o del servidor (5xx, sesión vencida) para respetar el orden; un rechazo
 * de datos (4xx) pasa a conflicto y se sigue con la siguiente.
 */
export function sincronizar({ store = colaIndexedDB, fetchFn = fetch as Fetch } = {}): Promise<ResultadoSync> {
  if (sincronizando) return sincronizando
  sincronizando = (async () => {
    const res: ResultadoSync = { enviadas: 0, conflictos: 0, pendientes: 0, sinConexion: false }
    const ops = await store.listar()
    let detenida = false
    for (const op of ops) {
      if (op.estado === "conflicto") { res.conflictos++; continue }
      if (detenida) { res.pendientes++; continue }
      try {
        const r = await enviar(fetchFn, op)
        if (r.ok) { await store.borrar(op.clave); res.enviadas++; continue }
        const b = await r.json().catch(() => ({}))
        if (r.status >= 500 || r.status === 401 || r.status === 429) {
          await store.guardar({ ...op, intentos: op.intentos + 1, error: r.status === 401 ? "Iniciá sesión de nuevo para enviar" : b.error })
          detenida = true; res.pendientes++; continue
        }
        await store.guardar({ ...op, estado: "conflicto", intentos: op.intentos + 1, error: b.error ?? `Rechazada (${r.status})` })
        res.conflictos++
      } catch (e) {
        if (!esErrorDeRed(e)) throw e
        detenida = true; res.sinConexion = true; res.pendientes++
      }
    }
    return res
  })().finally(() => { sincronizando = null })
  return sincronizando
}

/** Vuelve a intentar una operación en conflicto (por ejemplo, después de corregir el dato en otro lado). */
export async function reintentar(op: OperacionPendiente, store: ColaStore = colaIndexedDB) {
  await store.guardar({ ...op, estado: "pendiente", error: undefined })
}
