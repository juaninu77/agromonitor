import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ animal: vi.fn(), create: vi.fn(), audit: vi.fn() }))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => (request: unknown) =>
    handler(request, { userId: "u1", establecimientoIds: ["est1"], organizacionDeEstablecimiento: { est1: "org1" } }),
}))
vi.mock("@/lib/api/tenant", () => ({ animalDelTenant: mocks.animal, scopeEventoAnimal: () => ({}) }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: mocks.audit }))
vi.mock("@/lib/prisma", () => ({ prisma: { evtPesada: { create: mocks.create } } }))
import { POST as routePOST } from "@/app/api/ganado/pesos/route"
const POST = (body: object) =>
  routePOST(new NextRequest("http://localhost/api/ganado/pesos", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  })
const animalId = "00000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.resetAllMocks()
  mocks.animal.mockResolvedValue({ id: animalId, estadoVital: "activo", establecimientoId: "est1" })
  mocks.create.mockResolvedValue({ id: "p1" })
})
describe("POST /api/ganado/pesos", () => {
  it("registra con 201, guarda la condición corporal y audita", async () => {
    const res = await POST({ bovinoId: animalId, peso: 420, cc: 6.5, fecha: "2024-03-01" })
    expect(res.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId, pesoKg: 420, cc: 6.5 }) })
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ tabla: "evt_pesada", organizacionId: "org1" }))
  })
  it("rechaza animales dados de baja", async () => {
    mocks.animal.mockResolvedValue({ id: animalId, estadoVital: "muerto", establecimientoId: "est1" })
    const res = await POST({ animalId, peso: 420, fecha: "2024-03-01" })
    expect(res.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("rechaza fechas futuras antes de consultar la base", async () => {
    const futura = new Date(Date.now() + 86_400_000 * 3).toISOString()
    const res = await POST({ animalId, peso: 420, fecha: futura })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/futura/)
    expect(mocks.animal).not.toHaveBeenCalled()
  })
  it("no expone mensajes internos de la base", async () => {
    mocks.create.mockRejectedValue(new Error("connection refused at 10.0.0.1"))
    const res = await POST({ animalId, peso: 420, fecha: "2024-03-01" })
    expect(res.status).toBe(500)
    expect((await res.json()).error).not.toMatch(/10\.0\.0\.1/)
  })
})
