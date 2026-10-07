import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }))
const roles: Record<string, string> = { est1: "admin", est2: "operario" }
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => (request: unknown, { params }: { params: Promise<Record<string, string>> }) =>
    params.then((p) => handler(request, {
      userId: "u1", params: p, establecimientoIds: ["est1", "est2"], organizacionDeEstablecimiento: { est1: "org1", est2: "org2" },
      establecimientoIdsConRol: (r: string[]) => Object.keys(roles).filter((e) => r.includes(roles[e])),
    })),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sector: { findFirst: m.findFirst },
    $transaction: (cb: (tx: unknown) => unknown) => cb({ sector: { update: m.update, create: m.create }, auditLog: { createMany: m.audit } }),
  },
}))
import { POST as routePOST } from "@/app/api/sectores/[id]/dividir/route"

const id = "00000000-0000-4000-8000-000000000001"
const lon0 = -69.07, lat0 = -45.59, d = 0.01
const anillo = [[lon0, lat0], [lon0 + d, lat0], [lon0 + d, lat0 + d], [lon0, lat0 + d], [lon0, lat0]]
const POST = (body: object) => routePOST(new NextRequest(`http://localhost/api/sectores/${id}/dividir`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
const linea = [[lon0 + d * 0.3, lat0 - d * 0.1], [lon0 + d * 0.3, lat0 + d * 1.1]]

beforeEach(() => {
  vi.resetAllMocks()
  m.findFirst.mockResolvedValue({ id, establecimientoId: "est1", nombre: "Potrero Norte", tipo: "potrero", uso: "pastoreo", version: 3, superficieHa: 80, geometria: { type: "Polygon", coordinates: [anillo] } })
  m.update.mockImplementation(({ data }) => ({ id, nombre: data.nombre }))
  m.create.mockImplementation(({ data }) => ({ id: data.tipo === "alambrado" ? "al1" : "n1", nombre: data.nombre }))
})

describe("POST /api/sectores/[id]/dividir", () => {
  it("la parte más grande queda en el lugar original y la otra se crea, con alambrado y auditoría", async () => {
    const res = await POST({ version: 3, linea, nombreNuevo: "Potrero Norte Oeste" })
    expect(res.status).toBe(201)
    const body = (await res.json()).data
    expect(body.original.ha).toBeGreaterThan(body.nuevo.ha)
    expect(body.original.ha / (body.original.ha + body.nuevo.ha)).toBeCloseTo(0.7, 1)
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id, version: 3 }, data: expect.objectContaining({ superficieHa: body.original.ha }) }))
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nombre: "Potrero Norte Oeste", tipo: "potrero", uso: "pastoreo", superficieHa: body.nuevo.ha }) })
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "alambrado", geometria: expect.objectContaining({ type: "LineString" }) }) })
    expect(m.audit.mock.calls[0][0].data).toHaveLength(3)
  })
  it("sin alambrado crea solo la parte nueva", async () => {
    await POST({ version: 3, linea, nombreNuevo: "Oeste", guardarAlambrado: false })
    expect(m.create).toHaveBeenCalledTimes(1)
  })
  it("rechaza líneas que no cruzan el potrero y nombres repetidos", async () => {
    const adentro = [[lon0 + d * 0.2, lat0 + d * 0.2], [lon0 + d * 0.8, lat0 + d * 0.8]]
    expect((await POST({ version: 3, linea: adentro, nombreNuevo: "X" })).status).toBe(400)
    expect((await POST({ version: 3, linea, nombreNuevo: "potrero norte" })).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
  it("solo admin/encargado del campo y solo lugares con contorno", async () => {
    m.findFirst.mockResolvedValueOnce({ id, establecimientoId: "est2", geometria: { type: "Polygon", coordinates: [anillo] } })
    expect((await POST({ version: 3, linea, nombreNuevo: "X" })).status).toBe(403)
    m.findFirst.mockResolvedValueOnce({ id, establecimientoId: "est1", geometria: { type: "Point", coordinates: [lon0, lat0] } })
    expect((await POST({ version: 3, linea, nombreNuevo: "X" })).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
})
