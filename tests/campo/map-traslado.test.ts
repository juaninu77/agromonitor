import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  sector: vi.fn(), animales: vi.fn(), repetidas: vi.fn(), lote: vi.fn(),
  ubicUpd: vi.fn(), ubicCreate: vi.fn(), loteUpd: vi.fn(), loteCreate: vi.fn(), animalUpd: vi.fn(), movs: vi.fn(),
  pastAbiertos: vi.fn(), pastUpd: vi.fn(), ubicCount: vi.fn(), audit: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    sector: { findFirst: m.sector },
    animal: { findMany: (q: { where: { caravanaVisual?: unknown } }) => (q.where.caravanaVisual ? m.repetidas(q) : m.animales(q)), updateMany: m.animalUpd },
    lote: { findFirst: m.lote },
    ubicacionHist: { updateMany: m.ubicUpd, createMany: m.ubicCreate, count: m.ubicCount },
    animalLoteHist: { updateMany: m.loteUpd, createMany: m.loteCreate, findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    evtMovimiento: { createMany: m.movs },
    evtPastoreo: { findMany: m.pastAbiertos, update: m.pastUpd, updateMany: vi.fn(), create: vi.fn() },
    auditLog: { create: m.audit },
  }
  return { prisma: { $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { trasladarAnimales } from "@/lib/mapa/traslado"
import type { AuthContext } from "@/lib/api/with-auth"

const roles: Record<string, string> = { e1: "admin", e2: "admin", e3: "operario", eX: "admin" }
const ctx = {
  userId: "u1", establecimientoIds: ["e1", "e2", "e3", "eX"],
  organizacionDeEstablecimiento: { e1: "o1", e2: "o1", e3: "o1", eX: "o2" },
  establecimientoIdsConRol: (r: string[]) => Object.keys(roles).filter((e) => r.includes(roles[e])),
} as unknown as AuthContext
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const animal = (n: number, est = "e1") => ({ id: uuid(n), establecimientoId: est, especieId: "bov", caravanaVisual: `A-${n}`, ubicacionHist: [{ sectorId: "s-origen", desde: new Date(2025, 0, 1) }], loteHist: [{ loteId: "l-origen", desde: new Date(2025, 0, 1) }] })
const body = (extra: object = {}) => ({ animalIds: [uuid(1), uuid(2)], destinoSectorId: uuid(99), dte: "123-456", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.sector.mockResolvedValue({ id: uuid(99), establecimientoId: "e2", tipo: "potrero", nombre: "Potrero Sur" })
  m.animales.mockResolvedValue([animal(1), animal(2)])
  m.repetidas.mockResolvedValue([])
  m.pastAbiertos.mockResolvedValue([{ id: "p1", loteId: "l-origen", sectorId: "s-origen" }])
  m.ubicCount.mockResolvedValue(0)
})

describe("traslado entre campos", () => {
  it("cambia el campo, cierra origen, ubica en destino, registra DTe y cierra el pastoreo vacío", async () => {
    const r = await trasladarAnimales(body(), ctx)
    expect(r).toMatchObject({ trasladados: 2, destino: "Potrero Sur", establecimientoId: "e2" })
    expect(m.animalUpd).toHaveBeenCalledWith({ where: { id: { in: [uuid(1), uuid(2)] } }, data: { establecimientoId: "e2" } })
    expect(m.ubicUpd).toHaveBeenCalled(); expect(m.loteUpd).toHaveBeenCalled()
    expect(m.ubicCreate.mock.calls[0][0].data[0]).toMatchObject({ sectorId: uuid(99), motivo: "Traslado entre campos · DTe 123-456" })
    expect(m.movs.mock.calls[0][0].data[0]).toMatchObject({ origenSectorId: "s-origen", destinoSectorId: uuid(99) })
    expect(m.pastUpd).toHaveBeenCalledWith({ where: { id: "p1" }, data: { egreso: expect.any(Date) } })
    expect(m.audit).toHaveBeenCalled()
  })
  it("rechaza destino en el mismo campo, en otra organización o sin permisos en el origen", async () => {
    m.sector.mockResolvedValueOnce({ id: uuid(99), establecimientoId: "e1", tipo: "potrero", nombre: "X" })
    await expect(trasladarAnimales(body(), ctx)).rejects.toThrow(/ya están en ese campo/)
    m.sector.mockResolvedValueOnce({ id: uuid(99), establecimientoId: "eX", tipo: "potrero", nombre: "X" })
    await expect(trasladarAnimales(body(), ctx)).rejects.toThrow(/misma organización/)
    m.animales.mockResolvedValueOnce([animal(1, "e3"), animal(2, "e3")])
    await expect(trasladarAnimales(body(), ctx)).rejects.toMatchObject({ status: 403 })
    expect(m.animalUpd).not.toHaveBeenCalled()
  })
  it("no traslada si la caravana visual ya existe en el campo de destino", async () => {
    m.repetidas.mockResolvedValueOnce([{ caravanaVisual: "A-1" }])
    await expect(trasladarAnimales(body(), ctx)).rejects.toThrow(/A-1/)
    expect(m.animalUpd).not.toHaveBeenCalled()
  })
  it("valida que el grupo de destino sea del campo y de la misma especie", async () => {
    m.lote.mockResolvedValueOnce(null)
    await expect(trasladarAnimales(body({ loteDestinoId: uuid(50) }), ctx)).rejects.toThrow(/grupo de destino/)
    m.lote.mockResolvedValueOnce({ id: uuid(50), especieId: "ovi" })
    await expect(trasladarAnimales(body({ loteDestinoId: uuid(50) }), ctx)).rejects.toThrow(/otra especie/)
  })
})
