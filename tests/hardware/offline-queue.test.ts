import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  addPendingItem, clasificarRespuesta, comoLectura, cuerpoDeLectura, procesarCola, removePendingItem, resumenLectura, syncPendingItems,
  type PendingItem,
} from "@/lib/hardware/offline-queue"

let transaction: { oncomplete?: Function; onabort?: Function; onerror?: Function; error: Error | null; objectStore: Function }
let request: { result: number; onsuccess?: Function }
let openRequest: { result: unknown; onsuccess?: Function; onerror?: Function; error?: Error }
const close = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  request = { result: 7 }
  transaction = { error: null, objectStore: () => ({ add: () => request, delete: () => request }) }
  openRequest = { result: { transaction: () => transaction, close } }
  vi.stubGlobal("indexedDB", { open: () => openRequest })
})
afterEach(() => vi.unstubAllGlobals())
async function open() {
  openRequest.onsuccess?.()
  await Promise.resolve()
  await Promise.resolve()
}
describe("durabilidad de la cola offline", () => {
  it("espera el commit antes de confirmar una lectura", async () => {
    const done = vi.fn()
    const pending = addPendingItem({ sessionId: "s", eidLeido: "123", createdAt: "2026-01-01" })
    pending.then(done)
    await open()
    request.onsuccess?.()
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    transaction.oncomplete?.()
    expect(await pending).toBe(7)
    expect(close).toHaveBeenCalledOnce()
  })
  it("no informa éxito si el borrado se aborta", async () => {
    const pending = removePendingItem(7)
    const assertion = expect(pending).rejects.toThrow("disk full")
    await open()
    request.onsuccess?.()
    transaction.error = new Error("disk full")
    transaction.onabort?.()
    await assertion
    expect(close).toHaveBeenCalledOnce()
  })
  it("comparte una sincronización en curso para no enviar dos veces la misma cola", async () => {
    const first = syncPendingItems("session-single-flight")
    const second = syncPendingItems("session-single-flight")
    expect(first).toBe(second)
    const result = Promise.allSettled([first, second])
    openRequest.error = new Error("unavailable")
    openRequest.onerror?.()
    await result
    const retry = syncPendingItems("session-single-flight")
    expect(retry).not.toBe(first)
    const retryResult = Promise.allSettled([retry])
    openRequest.onerror?.()
    await retryResult
  })
})

const respuesta = (status: number, body: object = {}) => ({ status, ok: status < 300, json: async () => body }) as Response
const lectura = (id: number, extra: Partial<PendingItem> = {}): PendingItem => ({
  id, sessionId: "s", eidLeido: `98200000000000${id}`, createdAt: `2026-10-12T10:0${id}:00Z`, clave: `c${id}`, estado: "pendiente", intentos: 0, ...extra,
})
function deps(respuestas: Array<Response | Error>) {
  const enviar = vi.fn(async () => { const r = respuestas.shift()!; if (r instanceof Error) throw r; return r })
  return { enviar, guardar: vi.fn(async () => {}), borrar: vi.fn(async () => {}) }
}

describe("lecturas rechazadas al sincronizar", () => {
  it("clasifica la respuesta: 4xx a revisar, red o servidor a reintentar", () => {
    expect(clasificarRespuesta(201)).toBe("enviada")
    expect(clasificarRespuesta(400)).toBe("conflicto")
    expect(clasificarRespuesta(404)).toBe("conflicto")
    expect(clasificarRespuesta(409)).toBe("conflicto")
    expect(clasificarRespuesta(401)).toBe("reintentar")
    expect(clasificarRespuesta(429)).toBe("reintentar")
    expect(clasificarRespuesta(503)).toBe("reintentar")
  })
  it("un alta rechazada queda para revisar con el motivo y no frena a las demás", async () => {
    const d = deps([respuesta(400, { error: "El RFID 982000000000001 ya está registrado" }), respuesta(201)])
    const r = await procesarCola([lectura(1, { esNuevoRegistro: true }), lectura(2)], d)
    expect(r).toEqual({ synced: 1, pendientes: 0, conflictos: 1, sinConexion: false })
    expect(d.guardar).toHaveBeenCalledWith(expect.objectContaining({ id: 1, estado: "conflicto", intentos: 1, error: "El RFID 982000000000001 ya está registrado" }))
    expect(d.borrar).toHaveBeenCalledWith(2)
  })
  it("las que ya están para revisar no se reenvían solas", async () => {
    const d = deps([respuesta(201)])
    const r = await procesarCola([lectura(1, { estado: "conflicto", error: "x" }), lectura(2)], d)
    expect(d.enviar).toHaveBeenCalledOnce()
    expect(r).toMatchObject({ synced: 1, conflictos: 1 })
  })
  it("sin red o con error del servidor se detiene y las deja pendientes (no las marca para revisar)", async () => {
    const sinRed = deps([new TypeError("Failed to fetch")])
    expect(await procesarCola([lectura(1), lectura(2)], sinRed)).toEqual({ synced: 0, pendientes: 2, conflictos: 0, sinConexion: true })
    expect(sinRed.guardar).not.toHaveBeenCalled()

    const caido = deps([respuesta(503, { error: "Base no disponible" })])
    expect(await procesarCola([lectura(1), lectura(2)], caido)).toMatchObject({ pendientes: 2, conflictos: 0 })
    expect(caido.enviar).toHaveBeenCalledOnce()
    expect(caido.guardar).toHaveBeenCalledWith(expect.objectContaining({ id: 1, estado: "pendiente", intentos: 1, error: "Base no disponible" }))

    const vencida = deps([respuesta(401)])
    await procesarCola([lectura(1)], vencida)
    expect(vencida.guardar).toHaveBeenCalledWith(expect.objectContaining({ estado: "pendiente", error: "Iniciá sesión de nuevo para enviar" }))
  })
  it("las lecturas guardadas antes de esta versión (sin estado) se envían como pendientes", async () => {
    const d = deps([respuesta(201)])
    await procesarCola([lectura(1, { estado: undefined, clave: undefined })], d)
    expect(d.borrar).toHaveBeenCalledWith(1)
  })
  it("envía la clave para que un reenvío no registre la lectura dos veces", () => {
    expect(cuerpoDeLectura(lectura(3, { pesoKg: 300 }))).toMatchObject({ eidLeido: "982000000000003", pesoKg: 300, clave: "c3" })
    expect(cuerpoDeLectura(lectura(3))).not.toHaveProperty("estado")
  })
  it("«Guardar como lectura» quita el alta y el animal pero conserva lo cargado", () => {
    const alta = lectura(4, { estado: "conflicto", error: "RFID repetido", esNuevoRegistro: true, sexo: "F", razaId: "r", categoriaId: "c", caravanaVisual: "A-4", pesoKg: 310, accionSanidad: true })
    const simple = comoLectura(alta)
    expect(simple).toMatchObject({ estado: "pendiente", error: undefined, esNuevoRegistro: false, animalId: null, sexo: null, razaId: null, categoriaId: null, pesoKg: 310, accionSanidad: true, clave: "c4" })
    expect(resumenLectura(alta)).toBe("Alta A-4 · 310 kg · tratamiento")
    expect(resumenLectura(lectura(5))).toBe("Lectura")
  })
})
