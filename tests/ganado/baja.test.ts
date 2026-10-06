import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  animal: vi.fn(),
  cliente: vi.fn(),
  pesadasPosteriores: vi.fn(),
  tx: {
    evtBaja: { create: vi.fn() },
    evtPesada: { create: vi.fn() },
    animalLoteHist: { updateMany: vi.fn() },
    ubicacionHist: { updateMany: vi.fn() },
    animal: { update: vi.fn() },
  },
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    animal: { findFirst: mocks.animal },
    cliente: { findFirst: mocks.cliente },
    evtPesada: { count: mocks.pesadasPosteriores },
    $transaction: (cb: (tx: unknown) => unknown) => cb(mocks.tx),
  },
}))
import { BajaError, registrarBaja } from "@/lib/ganado/baja"

const animalId = "00000000-0000-4000-8000-000000000001"
const ctx = { establecimientoIds: ["est1"], organizacionIds: ["org1"] }
const fecha = new Date("2024-05-10T00:00:00Z")

beforeEach(() => {
  vi.resetAllMocks()
  mocks.animal.mockResolvedValue({ id: animalId, estadoVital: "activo", establecimientoId: "est1", caravanaVisual: "A-1" })
  mocks.pesadasPosteriores.mockResolvedValue(0)
  mocks.tx.evtBaja.create.mockResolvedValue({ id: "baja1" })
})

describe("registrarBaja", () => {
  it("rechaza animales fuera del alcance con 404", async () => {
    mocks.animal.mockResolvedValue(null)
    await expect(registrarBaja({ animalId, motivo: "otro", fecha }, ctx)).rejects.toMatchObject({ status: 404 })
    expect(mocks.tx.evtBaja.create).not.toHaveBeenCalled()
  })
  it("rechaza animales ya dados de baja", async () => {
    mocks.animal.mockResolvedValue({ id: animalId, estadoVital: "vendido", establecimientoId: "est1" })
    await expect(registrarBaja({ animalId, motivo: "otro", fecha }, ctx)).rejects.toBeInstanceOf(BajaError)
  })
  it("rechaza una fecha anterior a eventos ya registrados", async () => {
    mocks.pesadasPosteriores.mockResolvedValue(2)
    await expect(registrarBaja({ animalId, motivo: "muerte", fecha }, ctx)).rejects.toMatchObject({ status: 400 })
  })
  it("rechaza un cliente de otra organización", async () => {
    mocks.cliente.mockResolvedValue(null)
    await expect(registrarBaja({ animalId, motivo: "venta", fecha, clienteId: animalId }, ctx)).rejects.toMatchObject({ status: 403 })
  })
  it("crea el evento, cierra historiales y deja el estado según el motivo", async () => {
    const { animal } = await registrarBaja({ animalId, motivo: "venta", fecha, pesoVivoKg: 430 }, ctx)
    expect(animal.estadoVital).toBe("vendido")
    expect(mocks.tx.evtBaja.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ motivo: "venta", pesoVivoKg: 430 }) }))
    expect(mocks.tx.evtPesada.create).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId, pesoKg: 430, fecha }) })
    expect(mocks.tx.animalLoteHist.updateMany).toHaveBeenCalledWith({ where: { animalId, hasta: null }, data: { hasta: fecha } })
    expect(mocks.tx.ubicacionHist.updateMany).toHaveBeenCalledWith({ where: { animalId, hasta: null }, data: { hasta: fecha } })
    expect(mocks.tx.animal.update).toHaveBeenCalledWith({ where: { id: animalId }, data: { estadoVital: "vendido" } })
  })
  it("sin peso vivo no inventa una pesada", async () => {
    await registrarBaja({ animalId, motivo: "descarte", fecha }, ctx)
    expect(mocks.tx.evtPesada.create).not.toHaveBeenCalled()
    expect(mocks.tx.animal.update).toHaveBeenCalledWith({ where: { id: animalId }, data: { estadoVital: "baja" } })
  })
})
