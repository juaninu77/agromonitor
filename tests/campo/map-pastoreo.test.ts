import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
import { actualizarPastoreos } from "@/lib/mapa/move"

// Simula la base: miembros por lote y ubicación actual de cada animal
function tx(estado: { lotes: Record<string, string[]>; ubicacion: Record<string, string>; abiertos: { id: string; loteId: string; sectorId: string }[] }) {
  const loteDe = (animalId: string) => Object.entries(estado.lotes).find(([, ids]) => ids.includes(animalId))?.[0]
  return {
    animalLoteHist: {
      findMany: vi.fn(async ({ where }) => where.animalId.in.map((id: string) => ({ loteId: loteDe(id) })).filter((m: { loteId?: string }) => m.loteId)),
      count: vi.fn(async ({ where }) => estado.lotes[where.loteId]?.length ?? 0),
    },
    ubicacionHist: {
      count: vi.fn(async ({ where }) => {
        const loteId = where.animal.loteHist.some.loteId
        return (estado.lotes[loteId] ?? []).filter((a) => estado.ubicacion[a] === where.sectorId).length
      }),
    },
    evtPastoreo: {
      findMany: vi.fn(async () => estado.abiertos),
      updateMany: vi.fn(),
      create: vi.fn(async ({ data }) => ({ id: "nuevo", ...data })),
    },
  }
}
const potreroB = { id: "B", tipo: "potrero", establecimientoId: "est1" }
const now = new Date()

describe("rotación al mover animales", () => {
  it("mover un animal suelto no cierra el pastoreo del grupo que sigue en el potrero", async () => {
    const t = tx({ lotes: { L1: ["a1", "a2", "a3"] }, ubicacion: { a1: "B", a2: "A", a3: "A" }, abiertos: [{ id: "p1", loteId: "L1", sectorId: "A" }] })
    const r = await actualizarPastoreos(t as never, ["a1"], potreroB, null, now, "x")
    expect(t.evtPastoreo.updateMany).not.toHaveBeenCalled()
    expect(t.evtPastoreo.create).not.toHaveBeenCalled()
    expect(r).toBeNull()
  })
  it("cuando sale el último animal se cierra el pastoreo y, si todo el grupo llegó, se abre otro con la cantidad real", async () => {
    const t = tx({ lotes: { L1: ["a1", "a2"] }, ubicacion: { a1: "B", a2: "B" }, abiertos: [{ id: "p1", loteId: "L1", sectorId: "A" }] })
    const r = await actualizarPastoreos(t as never, ["a2"], potreroB, null, now, "x")
    expect(t.evtPastoreo.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["p1"] } }, data: { egreso: now } })
    expect(t.evtPastoreo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ loteId: "L1", sectorId: "B", animalesPromedio: 2 }) })
    expect(r).toMatchObject({ id: "nuevo" })
  })
  it("no duplica un pastoreo ya abierto en el destino ni abre pastoreos en corrales", async () => {
    const t = tx({ lotes: { L1: ["a1"] }, ubicacion: { a1: "B" }, abiertos: [{ id: "p1", loteId: "L1", sectorId: "B" }] })
    await actualizarPastoreos(t as never, ["a1"], potreroB, "L1", now, "x")
    expect(t.evtPastoreo.create).not.toHaveBeenCalled()
    const t2 = tx({ lotes: { L1: ["a1"] }, ubicacion: { a1: "C" }, abiertos: [] })
    await actualizarPastoreos(t2 as never, ["a1"], { id: "C", tipo: "corral", establecimientoId: "est1" }, "L1", now, "x")
    expect(t2.evtPastoreo.create).not.toHaveBeenCalled()
  })
})
