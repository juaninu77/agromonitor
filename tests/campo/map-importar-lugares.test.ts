import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ existentes: vi.fn(), crear: vi.fn(), audit: vi.fn(), idemPrevia: vi.fn(), idemCrear: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    sector: { findMany: m.existentes, createMany: m.crear },
    auditLog: { create: m.audit },
    operacionIdempotente: { findUnique: m.idemPrevia, create: m.idemCrear },
  }
  return { prisma: { $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { importarLugares } from "@/lib/mapa/importar-lugares"
import { MapError } from "@/lib/mapa/api"
import type { AuthContext } from "@/lib/api/with-auth"

const EST = "00000000-0000-4000-8000-000000000001", OTRO = "00000000-0000-4000-8000-000000000002"
const CLAVE = "00000000-0000-4000-8000-0000000000aa"
const roles: Record<string, string> = { [EST]: "encargado", [OTRO]: "operario" }
const ctx = {
  userId: "u1", establecimientoIds: [EST, OTRO], organizacionDeEstablecimiento: { [EST]: "o1", [OTRO]: "o1" },
  establecimientoIdsConRol: (r: string[]) => Object.keys(roles).filter((e) => r.includes(roles[e])),
} as unknown as AuthContext
const area = { type: "Polygon", coordinates: [[[-69, -45], [-68.99, -45], [-68.99, -44.99], [-69, -44.99], [-69, -45]]] }
const punto = { type: "Point", coordinates: [-69, -45] }

beforeEach(() => {
  vi.resetAllMocks()
  m.existentes.mockResolvedValue([{ nombre: "Potrero 1" }])
  m.crear.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
  m.idemPrevia.mockResolvedValue(null)
})

describe("crear en lote los lugares importados", () => {
  it("crea todos en una transacción, numera los nombres repetidos y deja auditoría", async () => {
    const r = await importarLugares(ctx, { establecimientoId: EST, clave: CLAVE, lugares: [
      { nombre: "Potrero 1", tipo: "potrero", geometria: area },
      { nombre: "Aguada norte", tipo: "aguada", descripcion: "Australiano", geometria: punto },
    ] })
    expect(m.existentes).toHaveBeenCalledWith({ where: { establecimientoId: EST }, select: { nombre: true } })
    const data = m.crear.mock.calls[0][0].data
    expect(data).toEqual([
      expect.objectContaining({ establecimientoId: EST, nombre: "Potrero 1 (2)", tipo: "potrero", geometria: area, descripcion: null }),
      expect.objectContaining({ establecimientoId: EST, nombre: "Aguada norte", tipo: "aguada", descripcion: "Australiano" }),
    ])
    expect(r.creados.map((c) => c.nombre)).toEqual(["Potrero 1 (2)", "Aguada norte"])
    expect(r.renombrados).toEqual([{ original: "Potrero 1", nombre: "Potrero 1 (2)" }])
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ tabla: "sectores", rowPk: CLAVE, organizacionId: "o1", detalle: expect.objectContaining({ importacion: true, lugares: 2 }) }) })
    expect(m.idemCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ clave: CLAVE, usuarioId: "u1", ruta: "sectores/importar" }) })
  })

  it("un reintento con la misma clave devuelve lo ya creado sin duplicar", async () => {
    m.idemPrevia.mockResolvedValue({ clave: CLAVE, usuarioId: "u1", ruta: "sectores/importar", resultado: { creados: [{ id: "s1", nombre: "P", tipo: "potrero" }], renombrados: [] } })
    const r = await importarLugares(ctx, { establecimientoId: EST, clave: CLAVE, lugares: [{ nombre: "P", tipo: "potrero", geometria: area }] })
    expect(r.creados).toHaveLength(1)
    expect(m.crear).not.toHaveBeenCalled()
  })

  it("solo admin o encargado del campo", async () => {
    await expect(importarLugares(ctx, { establecimientoId: OTRO, clave: CLAVE, lugares: [{ nombre: "P", tipo: "potrero", geometria: area }] }))
      .rejects.toBeInstanceOf(MapError)
    expect(m.crear).not.toHaveBeenCalled()
  })

  it("rechaza un tipo que no corresponde a la forma y las listas vacías", async () => {
    await expect(importarLugares(ctx, { establecimientoId: EST, clave: CLAVE, lugares: [{ nombre: "Punto", tipo: "potrero", geometria: punto }] }))
      .rejects.toThrow(/Potrero.*no puede ser un punto/)
    await expect(importarLugares(ctx, { establecimientoId: EST, clave: CLAVE, lugares: [] })).rejects.toThrow(/al menos un lugar/)
    expect(m.crear).not.toHaveBeenCalled()
  })
})
