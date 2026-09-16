import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({
  lote: vi.fn(), animals: vi.fn(), transaction: vi.fn(), count: vi.fn(), close: vi.fn(), create: vi.fn(),
}))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, { establecimientoIds: ["est1", "est2"] }) }))
vi.mock("@/lib/api/tenant", () => ({ loteDelTenant: mocks.lote }))
vi.mock("@/lib/prisma", () => ({ prisma: { animal: { findMany: mocks.animals }, $transaction: mocks.transaction } }))
import { POST as routePOST } from "@/app/api/ganado/movimiento-lote/route"
const POST = (request: NextRequest) => routePOST(request, { params: Promise.resolve({}) })

const animalId = "00000000-0000-4000-8000-000000000001"
const loteDestinoId = "00000000-0000-4000-8000-000000000002"
function request(body: object) {
  return new NextRequest("http://localhost/api/ganado/movimiento-lote", { method: "POST", body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.lote.mockResolvedValue({ id: loteDestinoId, establecimientoId: "est1", nombre: "Lote 1" })
  mocks.animals.mockResolvedValue([{ id: animalId, establecimientoId: "est1" }])
  mocks.count.mockResolvedValue(0)
  mocks.transaction.mockImplementation((callback) => callback({ animalLoteHist: { count: mocks.count, updateMany: mocks.close, create: mocks.create } }))
})
describe("movimiento entre lotes", () => {
  it("rechaza cruces de establecimiento aunque ambos sean accesibles", async () => {
    mocks.animals.mockResolvedValue([{ id: animalId, establecimientoId: "est2" }])
    expect((await POST(request({ animalIds: [animalId], loteDestinoId }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("rechaza fechas inválidas antes de consultar la base", async () => {
    expect((await POST(request({ animalIds: [animalId], loteDestinoId, fecha: "ayer" }))).status).toBe(400)
    expect(mocks.lote).not.toHaveBeenCalled()
  })
  it("deduplica animales y conserva el motivo", async () => {
    const response = await POST(request({ animalIds: [animalId, animalId], loteDestinoId, motivo: "Rotación" }))
    expect(response.status).toBe(200)
    expect((await response.json()).data.moved).toBe(1)
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId, motivo: "Rotación" }) })
  })
  it("no genera intervalos negativos en el historial", async () => {
    mocks.count.mockResolvedValue(1)
    expect((await POST(request({ animalIds: [animalId], loteDestinoId, fecha: "2020-01-01" }))).status).toBe(400)
    expect(mocks.close).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("rechaza selecciones parcialmente inaccesibles", async () => {
    mocks.animals.mockResolvedValue([])
    expect((await POST(request({ animalIds: [animalId], loteDestinoId }))).status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
