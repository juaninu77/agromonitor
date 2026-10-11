import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  protFindMany: vi.fn(), protFindFirst: vi.fn(), protCreate: vi.fn(), protUpdate: vi.fn(), protFindUnique: vi.fn(),
  itemDeleteMany: vi.fn(), itemUpdate: vi.fn(), itemCreate: vi.fn(), audit: vi.fn(), prodCount: vi.fn(),
  estFindUnique: vi.fn(), estUpdate: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    protocoloSanitario: { findMany: m.protFindMany, create: m.protCreate, update: m.protUpdate, findUniqueOrThrow: m.protFindUnique },
    itemProtocolo: { deleteMany: m.itemDeleteMany, update: m.itemUpdate, create: m.itemCreate },
    auditLog: { create: m.audit },
    establecimiento: { findUniqueOrThrow: m.estFindUnique, update: m.estUpdate },
  }
  return {
    prisma: {
      protocoloSanitario: { findFirst: m.protFindFirst, findMany: m.protFindMany },
      producto: { count: m.prodCount },
      establecimiento: { findUnique: m.estFindUnique },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { crearProtocolo, definirZonaAftosa, editarProtocolo } from "@/lib/sanidad/protocolos"
import { itemPlanSchema, textoMomento } from "@/lib/sanidad/plan"
import { PLANTILLAS } from "@/lib/sanidad/plantillas"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = uuid(1), PROT = uuid(2), I1 = uuid(3), I2 = uuid(4)
// vet en o1 (edita protocolos), sin rol de gestión en el campo
const vet = {
  userId: "u1", establecimientoIds: [EST], organizacionIds: ["o1"], organizacionDeEstablecimiento: { [EST]: "o1" },
  organizacionIdsConRol: (r: string[]) => (r.includes("vet") ? ["o1"] : []), establecimientoIdsConRol: () => [],
} as unknown as AuthContext
const operario = { ...vet, organizacionIdsConRol: () => [] } as unknown as AuthContext
const encargado = { ...vet, establecimientoIdsConRol: () => [EST] } as unknown as AuthContext

beforeEach(() => {
  vi.resetAllMocks()
  m.protFindMany.mockResolvedValue([])
  m.protCreate.mockImplementation(async ({ data }) => ({ id: PROT, ...data, items: data.items?.create ?? [] }))
  m.protFindUnique.mockResolvedValue({ id: PROT, items: [] })
})

describe("plantillas de la spec", () => {
  it("son cinco, con ítems válidos; la de zona libre no programa aftosa", () => {
    expect(PLANTILLAS.map((p) => p.codigo)).toEqual(["bovino_con_vacunacion", "bovino_zlsv", "ovino_patagonia", "ovino_prolana", "bovino_reproductores"])
    for (const p of PLANTILLAS) for (const i of p.items) expect(itemPlanSchema.safeParse(i).success).toBe(true)
    expect(PLANTILLAS.find((p) => p.codigo === "bovino_zlsv")!.items.some((i) => i.esAftosa)).toBe(false)
    expect(PLANTILLAS.find((p) => p.codigo === "bovino_con_vacunacion")!.items.filter((i) => i.esAftosa)).toHaveLength(2)
    // Hidatidosis: dosificación de perros cada 45 días
    expect(PLANTILLAS.find((p) => p.codigo === "ovino_patagonia")!.items.find((i) => i.repetirCadaDias)?.repetirCadaDias).toBe(45)
  })
  it("describe el momento de cada ítem", () => {
    expect(textoMomento({ momento: "destete", mes: null, dia: null, diasOffset: 30, repetirCadaDias: null })).toBe("Destete + 30 días")
    expect(textoMomento({ momento: "fecha", mes: 3, dia: 5, diasOffset: 0, repetirCadaDias: null })).toBe("05/03")
    expect(textoMomento({ momento: "inicio", mes: null, dia: null, diasOffset: 0, repetirCadaDias: 45 })).toBe("Inicio del calendario · cada 45 días")
  })
  it("una fecha fija necesita día y mes", () => {
    expect(itemPlanSchema.safeParse({ nombre: "Vacuna", momento: "fecha" }).success).toBe(false)
  })
})

describe("protocolos", () => {
  it("copia una plantilla a la organización con un nombre libre", async () => {
    m.protFindMany.mockResolvedValue([{ nombre: "Ovino Patagonia base" }])
    const p = await crearProtocolo(vet, { establecimientoId: EST, plantilla: "ovino_patagonia" })
    const data = m.protCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ organizacionId: "o1", nombre: "Ovino Patagonia base (2)", especie: "ovino", plantilla: "ovino_patagonia" })
    expect(data.items.create).toHaveLength(PLANTILLAS.find((t) => t.codigo === "ovino_patagonia")!.items.length)
    expect(data.items.create[0]).toMatchObject({ orden: 0, momento: "campania_otono" })
    expect(p.id).toBe(PROT)
    expect(m.audit).toHaveBeenCalled()
  })
  it("un operario no crea protocolos; un campo ajeno da 404; sin plantilla pide nombre y especie", async () => {
    await expect(crearProtocolo(operario, { establecimientoId: EST, plantilla: "bovino_zlsv" })).rejects.toMatchObject({ status: 403 })
    await expect(crearProtocolo(vet, { establecimientoId: uuid(99), plantilla: "bovino_zlsv" })).rejects.toMatchObject({ status: 404 })
    await expect(crearProtocolo(vet, { establecimientoId: EST })).rejects.toMatchObject({ status: 400 })
    await expect(crearProtocolo(vet, { establecimientoId: EST, plantilla: "inventada" })).rejects.toMatchObject({ status: 404 })
  })
  it("sincroniza los ítems: actualiza, crea y borra los que faltan", async () => {
    m.protFindFirst.mockResolvedValue({ id: PROT, organizacionId: "o1", items: [{ id: I1 }, { id: I2 }] })
    await editarProtocolo(vet, PROT, { nombre: "Mi plan", items: [{ id: I1, nombre: "Brucelosis", momento: "campania_otono" }, { nombre: "Nuevo", momento: "fecha", mes: 4, dia: 1 }] })
    expect(m.protUpdate.mock.calls[0][0].data).toEqual({ nombre: "Mi plan" })
    expect(m.itemDeleteMany.mock.calls[0][0].where).toEqual({ protocoloId: PROT, id: { notIn: [I1] } })
    expect(m.itemUpdate.mock.calls[0][0]).toMatchObject({ where: { id: I1 }, data: { orden: 0, nombre: "Brucelosis" } })
    expect(m.itemCreate.mock.calls[0][0].data).toMatchObject({ orden: 1, mes: 4, dia: 1, protocoloId: PROT })
  })
  it("rechaza ítems de otro protocolo y productos de otra organización", async () => {
    m.protFindFirst.mockResolvedValue({ id: PROT, organizacionId: "o1", items: [{ id: I1 }] })
    await expect(editarProtocolo(vet, PROT, { items: [{ id: uuid(77), nombre: "X1", momento: "inicio" }] })).rejects.toThrow(/no pertenece/)
    m.prodCount.mockResolvedValue(0)
    await expect(editarProtocolo(vet, PROT, { items: [{ nombre: "X1", momento: "inicio", productoId: uuid(88) }] })).rejects.toThrow(/organización/)
    await expect(editarProtocolo(operario, PROT, { activo: false })).rejects.toMatchObject({ status: 403 })
  })
})

describe("zona de aftosa", () => {
  it("la define el encargado del campo, no el vet, y queda auditada", async () => {
    await expect(definirZonaAftosa(vet, { establecimientoId: EST, zonaAftosa: "libre_sin_vacunacion" })).rejects.toMatchObject({ status: 403 })
    m.estFindUnique.mockResolvedValue({ zonaAftosa: null })
    m.estUpdate.mockResolvedValue({ id: EST, zonaAftosa: "libre_sin_vacunacion" })
    await definirZonaAftosa(encargado, { establecimientoId: EST, zonaAftosa: "libre_sin_vacunacion" })
    expect(m.audit.mock.calls[0][0].data.detalle).toEqual({ zonaAftosa: { antes: null, despues: "libre_sin_vacunacion" } })
    await expect(definirZonaAftosa(encargado, { establecimientoId: EST, zonaAftosa: "inventada" })).rejects.toThrow()
  })
})
