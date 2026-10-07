import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), ubic: vi.fn(), past: vi.fn(), res: vi.fn(), audit: vi.fn(), pFind: vi.fn(), pUpd: vi.fn() }))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => (request: unknown, { params }: { params: Promise<Record<string, string>> }) =>
    params.then((p) => handler(request, {
      userId: "u1", params: p, establecimientoIds: ["e1"], organizacionDeEstablecimiento: { e1: "o1" },
      establecimientoIdsConRol: () => ["e1"],
    })),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    sector: { update: m.update }, auditLog: { create: m.audit },
    ubicacionHist: { count: m.ubic }, evtPastoreo: { count: m.past, update: m.pUpd }, reservaForraje: { count: m.res },
  }
  return { prisma: { sector: { findFirst: m.findFirst }, evtPastoreo: { findFirst: m.pFind }, ubicacionHist: { count: m.ubic }, $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { PATCH as sectorPATCH } from "@/app/api/sectores/[id]/route"
import { PATCH as pastoreoPATCH } from "@/app/api/pastoreo/[id]/route"

const id = "00000000-0000-4000-8000-000000000001"
const req = (url: string, body: object) => new NextRequest(url, { method: "PATCH", body: JSON.stringify(body) })
beforeEach(() => {
  vi.resetAllMocks()
  m.findFirst.mockResolvedValue({ id, establecimientoId: "e1", nombre: "Potrero Norte", version: 2, geometria: null })
  m.update.mockResolvedValue({ id, version: 3 })
  m.ubic.mockResolvedValue(0); m.past.mockResolvedValue(0); m.res.mockResolvedValue(0)
})

describe("archivar lugares", () => {
  it("rechaza con 409 si hay animales, pastoreo o stock, sin modificar", async () => {
    m.ubic.mockResolvedValue(3); m.past.mockResolvedValue(1)
    const res = await sectorPATCH(req(`http://x/api/sectores/${id}`, { version: 2, activo: false }), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/3 animales ubicados, tiene un grupo pastoreando/)
    expect(m.update).not.toHaveBeenCalled()
  })
  it("archiva un lugar vacío y lo audita", async () => {
    const res = await sectorPATCH(req(`http://x/api/sectores/${id}`, { version: 2, activo: false }), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith({ where: { id, version: 2 }, data: expect.objectContaining({ activo: false }) })
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ detalle: expect.objectContaining({ activo: false }) }) })
  })
  it("para restaurar busca también entre los archivados", async () => {
    await sectorPATCH(req(`http://x/api/sectores/${id}`, { version: 2, activo: true }), { params: Promise.resolve({ id }) })
    expect(m.findFirst.mock.calls[0][0].where).not.toHaveProperty("activo")
  })
})

describe("salida de pastoreo", () => {
  const pastoreo = { id, loteId: "l1", sectorId: "s1", ingreso: new Date("2026-09-01T00:00:00Z"), egreso: null, sector: { establecimientoId: "e1", nombre: "Potrero Norte" } }
  const PATCH = (body: object) => pastoreoPATCH(req(`http://x/api/pastoreo/${id}`, body), { params: Promise.resolve({ id }) })
  it("no cierra si el grupo todavía tiene animales en el lugar", async () => {
    m.pFind.mockResolvedValue(pastoreo); m.ubic.mockResolvedValue(4)
    const res = await PATCH({ egreso: "2026-10-01" })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Mover animales/)
  })
  it("rechaza fechas futuras o anteriores al ingreso y cierra las válidas", async () => {
    m.pFind.mockResolvedValue(pastoreo)
    expect((await PATCH({ egreso: "2099-01-01" })).status).toBe(400)
    expect((await PATCH({ egreso: "2026-08-01" })).status).toBe(400)
    m.pUpd.mockResolvedValue({ id })
    expect((await PATCH({ egreso: "2026-10-01" })).status).toBe(200)
    expect(m.pUpd).toHaveBeenCalledWith({ where: { id }, data: { egreso: new Date("2026-10-01T12:00:00Z") } })
  })
})
