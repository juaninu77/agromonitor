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
    movimientoFinanciero: { create: vi.fn() },
  },
  cuenta: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    animal: { findFirst: mocks.animal },
    cliente: { findFirst: mocks.cliente },
    cuentaFinanciera: { findFirst: mocks.cuenta },
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
  describe("cobro de la venta en Finanzas", () => {
    const cuentaId = "00000000-0000-4000-8000-0000000000c1"
    it("crea el ingreso vinculado a la baja en la cuenta elegida", async () => {
      mocks.cuenta.mockResolvedValue({ activa: true, moneda: "ARS" })
      mocks.cliente.mockResolvedValue({ id: "c1", nombre: "Frigorífico Sur" })
      await registrarBaja(
        { animalId, motivo: "venta", fecha, precioTotal: 1250000.5, cuentaId, clienteId: "00000000-0000-4000-8000-0000000000aa" },
        { ...ctx, userId: "u1" },
      )
      expect(mocks.cuenta).toHaveBeenCalledWith(expect.objectContaining({ where: { id: cuentaId, establecimientoId: "est1" } }))
      expect(mocks.tx.movimientoFinanciero.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          establecimientoId: "est1",
          cuentaId,
          tipo: "ingreso",
          categoria: "venta_hacienda",
          importe: "1250000.50",
          bajaId: "baja1",
          contraparte: "Frigorífico Sur",
          creadoPorId: "u1",
        }),
      })
    })
    it("sin cuenta no crea movimiento", async () => {
      await registrarBaja({ animalId, motivo: "venta", fecha, precioTotal: 1000 }, ctx)
      expect(mocks.tx.movimientoFinanciero.create).not.toHaveBeenCalled()
    })
    it("rechaza la cuenta si no es una venta con precio", async () => {
      await expect(registrarBaja({ animalId, motivo: "muerte", fecha, cuentaId }, ctx)).rejects.toMatchObject({ status: 400 })
      await expect(registrarBaja({ animalId, motivo: "venta", fecha, cuentaId }, ctx)).rejects.toMatchObject({ status: 400 })
      expect(mocks.tx.evtBaja.create).not.toHaveBeenCalled()
    })
    it("rechaza cuentas de otro campo, desactivadas o en dólares", async () => {
      const venta = { animalId, motivo: "venta" as const, fecha, precioTotal: 1000, cuentaId }
      mocks.cuenta.mockResolvedValueOnce(null)
      await expect(registrarBaja(venta, ctx)).rejects.toThrow(/no pertenece/)
      mocks.cuenta.mockResolvedValueOnce({ activa: false, moneda: "ARS" })
      await expect(registrarBaja(venta, ctx)).rejects.toThrow(/desactivada/)
      mocks.cuenta.mockResolvedValueOnce({ activa: true, moneda: "USD" })
      await expect(registrarBaja(venta, ctx)).rejects.toThrow(/ARS/)
      expect(mocks.tx.evtBaja.create).not.toHaveBeenCalled()
    })
  })
})
