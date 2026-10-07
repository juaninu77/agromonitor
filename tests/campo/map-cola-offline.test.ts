import { describe, expect, it, vi } from "vitest"
import { enviarOEncolar, esEncolable, reintentar, sincronizar, type ColaStore, type OperacionPendiente } from "@/lib/mapa/cola-offline"
import { conClave } from "@/lib/mapa/idempotencia"
import type { Prisma } from "@prisma/client"

function memoria(inicial: OperacionPendiente[] = []): ColaStore & { ops: Map<string, OperacionPendiente> } {
  const ops = new Map(inicial.map((o) => [o.clave, o]))
  return {
    ops,
    listar: async () => [...ops.values()].sort((a, b) => a.creadaAt.localeCompare(b.creadaAt)),
    guardar: async (op) => { ops.set(op.clave, op) },
    borrar: async (clave) => { ops.delete(clave) },
  }
}
const op = (clave: string, min: number, extra: Partial<OperacionPendiente> = {}): OperacionPendiente => ({
  clave, url: "/api/mapa/movimientos", body: { clave }, etiqueta: `Mover ${clave}`, establecimientoId: "e1",
  creadaAt: `2026-10-07T10:${String(min).padStart(2, "0")}:00Z`, estado: "pendiente", intentos: 0, ...extra,
})
const resp = (status: number, body: object = {}) => new Response(JSON.stringify(body), { status })
const nueva = { clave: "k1", url: "/api/mapa/movimientos", body: { clave: "k1" }, etiqueta: "Mover 2 animales", establecimientoId: "e1" }

describe("enviar o encolar", () => {
  it("con conexión envía; sin conexión o si la red falla, guarda en el dispositivo", async () => {
    const store = memoria()
    await expect(enviarOEncolar(nueva, { store, online: true, fetchFn: async () => resp(201, { data: { moved: 2 } }) })).resolves.toEqual({ estado: "enviada", data: { moved: 2 } })
    expect(store.ops.size).toBe(0)
    await expect(enviarOEncolar(nueva, { store, online: false, fetchFn: vi.fn() })).resolves.toEqual({ estado: "encolada" })
    await expect(enviarOEncolar({ ...nueva, clave: "k2" }, { store, online: true, fetchFn: async () => { throw new TypeError("Failed to fetch") } })).resolves.toEqual({ estado: "encolada" })
    expect([...store.ops.values()].map((o) => [o.clave, o.estado])).toEqual([["k1", "pendiente"], ["k2", "pendiente"]])
  })

  it("un rechazo del servidor se informa en el momento y no se encola", async () => {
    const store = memoria()
    await expect(enviarOEncolar(nueva, { store, online: true, fetchFn: async () => resp(409, { error: "La ubicación cambió" }) })).resolves.toEqual({ estado: "error", error: "La ubicación cambió" })
    expect(store.ops.size).toBe(0)
  })

  it("solo encola rutas idempotentes del mapa", () => {
    expect(esEncolable("/api/mapa/movimientos")).toBe(true)
    expect(esEncolable("/api/sectores/7c4bb2af-2185-42d4-89cc-e5f759808ccc/mediciones")).toBe(true)
    expect(esEncolable("/api/sectores/7c4bb2af-2185-42d4-89cc-e5f759808ccc/ficha")).toBe(true)
    expect(esEncolable("/api/mapa/traslados")).toBe(false)
    expect(esEncolable("/api/sectores/7c4bb2af-2185-42d4-89cc-e5f759808ccc/stock")).toBe(false)
  })
})

describe("sincronizar", () => {
  it("envía en orden; un rechazo pasa a conflicto y sigue con las demás", async () => {
    const store = memoria([op("c", 3), op("a", 1), op("b", 2)])
    const orden: string[] = []
    const fetchFn = async (_u: string, init: RequestInit) => {
      const { clave } = JSON.parse(String(init.body)); orden.push(clave)
      return clave === "b" ? resp(409, { error: "Los animales ya están en ese lugar" }) : resp(201, { data: {} })
    }
    await expect(sincronizar({ store, fetchFn })).resolves.toEqual({ enviadas: 2, conflictos: 1, pendientes: 0, sinConexion: false })
    expect(orden).toEqual(["a", "b", "c"])
    expect(store.ops.get("b")).toMatchObject({ estado: "conflicto", error: "Los animales ya están en ese lugar", intentos: 1 })
    expect(store.ops.size).toBe(1)
  })

  it("sin señal o con error del servidor se detiene para respetar el orden", async () => {
    const store = memoria([op("a", 1), op("b", 2)])
    const sinRed = vi.fn(async () => { throw new TypeError("offline") })
    await expect(sincronizar({ store, fetchFn: sinRed })).resolves.toMatchObject({ enviadas: 0, pendientes: 2, sinConexion: true })
    expect(sinRed).toHaveBeenCalledTimes(1)

    const caido = vi.fn(async () => resp(500, { error: "No se pudo completar" }))
    await expect(sincronizar({ store, fetchFn: caido })).resolves.toMatchObject({ enviadas: 0, pendientes: 2, conflictos: 0 })
    expect(caido).toHaveBeenCalledTimes(1)
    expect(store.ops.get("a")).toMatchObject({ estado: "pendiente", intentos: 1 })
  })

  it("los conflictos no se reenvían hasta que se pide reintentar", async () => {
    const store = memoria([op("a", 1, { estado: "conflicto", error: "x" })])
    const fetchFn = vi.fn(async () => resp(201, { data: {} }))
    await expect(sincronizar({ store, fetchFn })).resolves.toMatchObject({ enviadas: 0, conflictos: 1 })
    expect(fetchFn).not.toHaveBeenCalled()
    await reintentar(store.ops.get("a")!, store)
    await expect(sincronizar({ store, fetchFn })).resolves.toMatchObject({ enviadas: 1, conflictos: 0 })
    expect(store.ops.size).toBe(0)
  })
})

describe("idempotencia en el servidor", () => {
  const tx = (prior: unknown) => {
    const create = vi.fn()
    return { create, tx: { operacionIdempotente: { findUnique: vi.fn(async () => prior), create } } as unknown as Prisma.TransactionClient }
  }
  it("la primera vez ejecuta y guarda el resultado; un reenvío devuelve lo mismo sin repetir", async () => {
    const a = tx(null), fn = vi.fn(async () => ({ moved: 3 }))
    await expect(conClave(a.tx, { clave: "k", usuarioId: "u1", ruta: "mapa/movimientos" }, fn)).resolves.toEqual({ moved: 3 })
    expect(a.create).toHaveBeenCalledWith({ data: { clave: "k", usuarioId: "u1", ruta: "mapa/movimientos", resultado: { moved: 3 } } })
    const b = tx({ clave: "k", usuarioId: "u1", ruta: "mapa/movimientos", resultado: { moved: 3 } }), fn2 = vi.fn()
    await expect(conClave(b.tx, { clave: "k", usuarioId: "u1", ruta: "mapa/movimientos" }, fn2)).resolves.toEqual({ moved: 3 })
    expect(fn2).not.toHaveBeenCalled()
  })
  it("rechaza una clave usada por otro usuario u otra operación", async () => {
    const b = tx({ clave: "k", usuarioId: "u2", ruta: "mapa/movimientos", resultado: {} })
    await expect(conClave(b.tx, { clave: "k", usuarioId: "u1", ruta: "mapa/movimientos" }, vi.fn())).rejects.toMatchObject({ status: 409 })
  })
})
