import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), lock: vi.fn(), session: vi.fn(), update: vi.fn(),
  animal: vi.fn(), animals: vi.fn(), createAnimal: vi.fn(), especie: vi.fn(), aggregate: vi.fn(),
  item: vi.fn(), createMany: vi.fn(), lastItem: vi.fn(), pesada: vi.fn(), sanidad: vi.fn(), tacto: vi.fn(),
}))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, {
  params: { id: "00000000-0000-4000-8000-000000000001" }, establecimientoIds: ["est1", "est2"],
  organizacionDeEstablecimiento: { est1: "org1" },
}) }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: vi.fn() }))
import { POST as addItemRoute } from "@/app/api/manga/[id]/items/route"
import { POST as finalizeRoute } from "@/app/api/manga/[id]/finalizar/route"
import { POST as importCSVRoute } from "@/app/api/manga/importar-csv/route"
import { PATCH as patchRoute } from "@/app/api/manga/[id]/route"
const context = { params: Promise.resolve({}) }
const addItem = (request: NextRequest) => addItemRoute(request, context)
const finalize = (request: NextRequest) => finalizeRoute(request, context)
const importCSV = (request: NextRequest) => importCSVRoute(request, context)
const PATCH = (request: NextRequest) => patchRoute(request, context)

const id = "00000000-0000-4000-8000-000000000001"
const tx = {
  sesionManga: { updateMany: mocks.lock, findFirst: mocks.session, update: mocks.update },
  animal: { findFirst: mocks.animal, findMany: mocks.animals, create: mocks.createAnimal }, especie: { findFirst: mocks.especie },
  sesionMangaItem: { aggregate: mocks.aggregate, create: mocks.item, createMany: mocks.createMany, findFirst: mocks.lastItem },
  evtPesada: { create: mocks.pesada }, evtSanidad: { create: mocks.sanidad }, evtTacto: { create: mocks.tacto },
}
function request(body: object = {}) {
  return new NextRequest("http://localhost/api/manga/test", { method: "POST", body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  mocks.transaction.mockImplementation((callback) => callback(tx))
  mocks.lock.mockResolvedValue({ count: 1 })
  mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), items: [] })
  mocks.aggregate.mockResolvedValue({ _max: { orden: 3 } })
  mocks.especie.mockResolvedValue({ id: "bovino" })
  mocks.createAnimal.mockResolvedValue({ id: "new-animal" })
  mocks.item.mockResolvedValue({ id: "item" })
  mocks.animals.mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())

describe("rutas de manga", () => {
  it("busca animales exclusivamente en el establecimiento de la sesión", async () => {
    mocks.animal.mockResolvedValue(null)
    expect((await addItem(request({ eidLeido: "123", animalId: id }))).status).toBe(404)
    expect(mocks.animal).toHaveBeenCalledWith({ where: { id, establecimientoId: "est1" } })
    expect(mocks.item).not.toHaveBeenCalled()
  })
  it("crea animal, lectura y contador en la misma transacción", async () => {
    expect((await addItem(request({ eidLeido: "123", esNuevoRegistro: true, sexo: "F" }))).status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.createAnimal).toHaveBeenCalledOnce()
    expect(mocks.item).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId: "new-animal", orden: 4 }) })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: { totalAnimales: { increment: 1 } } })
  })
  it("propaga el fallo de lectura fuera del callback para revertir el alta", async () => {
    mocks.item.mockRejectedValue(new Error("insert failed"))
    let rolledBack = false
    mocks.transaction.mockImplementation(async (callback) => {
      try { return await callback(tx) } catch (error) { rolledBack = true; throw error }
    })
    expect((await addItem(request({ eidLeido: "123", esNuevoRegistro: true, sexo: "F" }))).status).toBe(500)
    expect(rolledBack).toBe(true)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("requiere sexo para altas nuevas", async () => {
    expect((await addItem(request({ eidLeido: "123", esNuevoRegistro: true }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("genera eventos al finalizar", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", fecha: new Date(), productoSanidadId: "producto", items: [
      { animalId: "animal", pesoKg: 320, accionSanidad: true, resultadoTacto: "preñada" },
    ] })
    const response = await finalize(request())
    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ totalPesados: 1, totalSanidad: 1, totalTactos: 1 })
    expect(mocks.pesada).toHaveBeenCalledOnce()
    expect(mocks.sanidad).toHaveBeenCalledOnce()
    expect(mocks.tacto).toHaveBeenCalledOnce()
  })
  it("un segundo cierre no genera eventos", async () => {
    mocks.lock.mockResolvedValue({ count: 0 })
    expect((await finalize(request())).status).toBe(409)
    expect(mocks.pesada).not.toHaveBeenCalled()
  })
  it("PATCH no permite saltear la generación de eventos", async () => {
    expect((await PATCH(request({ estado: "finalizada" }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("PATCH no reabre una sesión finalizada", async () => {
    mocks.lock.mockResolvedValue({ count: 0 })
    expect((await PATCH(request({ estado: "activa" }))).status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("importa CSV y actualiza el contador en una sola transacción", async () => {
    mocks.lastItem.mockResolvedValue({ orden: 5 })
    mocks.createMany.mockResolvedValue({ count: 2 })
    mocks.animals.mockResolvedValue([{ id: "animal-known", caravanaRfid: "123" }])
    const response = await importCSV(request({ sessionId: id, items: [{ eidLeido: "123" }, { eidLeido: "456" }] }))
    expect(await response.json()).toEqual({ imported: 2 })
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.createMany.mock.calls[0][0].data.map((item: { orden: number }) => item.orden)).toEqual([6, 7])
    expect(mocks.createMany.mock.calls[0][0].data.map((item: { animalId: string | null }) => item.animalId)).toEqual(["animal-known", null])
    expect(mocks.animals).toHaveBeenCalledWith({
      where: { establecimientoId: "est1", caravanaRfid: { in: ["123", "456"] } },
      select: { id: true, caravanaRfid: true },
    })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: { totalAnimales: { increment: 2 } } })
  })
  it("rechaza fechas CSV inválidas", async () => {
    expect((await importCSV(request({ sessionId: id, items: [{ eidLeido: "123", timestampLectura: "invalid" }] }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
