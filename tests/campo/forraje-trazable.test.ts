import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"
import { registrarCosecha, registrarMovimiento, totalesPorUnidad, transferirForraje } from "@/lib/campo/forrajes"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const CAMPO = uuid(1), CULTIVO = uuid(2), RESERVA = uuid(3), GALPON = uuid(4), GALPON2 = uuid(5), POTRERO = uuid(6), LOTE = uuid(7), CLAVE = uuid(8)
const ctx = { userId: "u1", organizacionDeEstablecimiento: { [CAMPO]: "o1" } } as unknown as AuthContext
const D = (v: string | number) => new Prisma.Decimal(v)

const m = {
  reservaFirst: vi.fn(), reservaMany: vi.fn(), reservaCreate: vi.fn(), reservaUpd: vi.fn(),
  movUnique: vi.fn(), movCreate: vi.fn(), cultivo: vi.fn(), sector: vi.fn(), lote: vi.fn(), audit: vi.fn(),
}
const tx = {
  reservaForraje: { findFirst: m.reservaFirst, findMany: m.reservaMany, create: m.reservaCreate, updateMany: m.reservaUpd },
  movimientoForraje: { findUnique: m.movUnique, create: m.movCreate },
  sectorForraje: { findFirst: m.cultivo },
  sector: { findFirst: m.sector },
  lote: { findFirst: m.lote },
  auditLog: { create: m.audit },
} as unknown as Prisma.TransactionClient

const reserva = (extra: object = {}) => ({ id: RESERVA, establecimientoId: CAMPO, forrajeId: "alfalfa", cultivoId: CULTIVO, depositoId: GALPON, deposito: { nombre: "Galpón Principal" }, nombre: "Fardos alfalfa", unidad: "fardos", ubicacion: "Galpón Principal", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.movUnique.mockResolvedValue(null)
  m.reservaUpd.mockResolvedValue({ count: 1 })
  m.movCreate.mockImplementation(async ({ data }) => ({ id: `mov-${m.movCreate.mock.calls.length}`, ...data }))
  m.reservaCreate.mockImplementation(async ({ data }) => ({ id: "nueva", ...data }))
  m.cultivo.mockResolvedValue({ id: CULTIVO, forrajeId: "alfalfa", desde: new Date("2025-09-01"), hasta: null, sector: { nombre: "Potrero Norte" }, forraje: { nombre: "Alfalfa" } })
})

describe("cosecha trazable", () => {
  const cosecha = (extra: object = {}) => ({ establecimientoId: CAMPO, clave: CLAVE, cultivoId: CULTIVO, cantidad: "120", fecha: "2026-01-10", nombre: "Fardos alfalfa", unidad: "fardos", depositoId: GALPON, ...extra })

  it("crea la reserva en cero y suma la cosecha con una entrada vinculada a la campaña", async () => {
    m.sector.mockResolvedValueOnce({ id: GALPON, nombre: "Galpón Principal" })
    const row = await registrarCosecha(tx, ctx, CAMPO, cosecha())
    const creada = m.reservaCreate.mock.calls[0][0].data
    expect(creada).toMatchObject({ cultivoId: CULTIVO, forrajeId: "alfalfa", depositoId: GALPON, unidad: "fardos" })
    expect(creada).not.toHaveProperty("stock")
    expect(m.reservaUpd).toHaveBeenCalledWith({ where: { id: "nueva", establecimientoId: CAMPO }, data: { stock: { increment: "120" } } })
    expect(row).toMatchObject({ tipo: "entrada", concepto: "cosecha", cultivoId: CULTIVO, cantidad: "120", motivo: "Cosecha de Alfalfa en Potrero Norte" })
  })

  it("rechaza una reserva de otro forraje, fechas fuera de la campaña y fardos fraccionados", async () => {
    m.reservaFirst.mockResolvedValueOnce(reserva({ forrajeId: "avena" }))
    await expect(registrarCosecha(tx, ctx, CAMPO, cosecha({ reservaId: RESERVA }))).rejects.toThrow(/otro forraje/)
    await expect(registrarCosecha(tx, ctx, CAMPO, cosecha({ fecha: "2025-08-01" }))).rejects.toThrow(/anterior a la siembra/)
    m.reservaFirst.mockResolvedValueOnce(reserva())
    await expect(registrarCosecha(tx, ctx, CAMPO, cosecha({ reservaId: RESERVA, cantidad: "1.5" }))).rejects.toThrow(/unidades enteras/)
    expect(m.movCreate).not.toHaveBeenCalled()
  })

  it("un reintento con la misma clave devuelve la operación original sin sumar de nuevo", async () => {
    const prior = { id: "m1", reservaId: RESERVA, concepto: "cosecha", cultivoId: CULTIVO, cantidad: D(120), fecha: new Date("2026-01-10T00:00:00Z") }
    m.movUnique.mockResolvedValue(prior)
    await expect(registrarCosecha(tx, ctx, CAMPO, cosecha())).resolves.toBe(prior)
    await expect(registrarCosecha(tx, ctx, CAMPO, cosecha({ cantidad: "100" }))).rejects.toMatchObject({ status: 409 })
    expect(m.reservaUpd).not.toHaveBeenCalled()
  })
})

describe("consumo con destino", () => {
  const consumo = (extra: object = {}) => ({ establecimientoId: CAMPO, reservaId: RESERVA, clave: CLAVE, tipo: "salida", concepto: "consumo", cantidad: "15", fecha: "2026-01-12", sectorId: POTRERO, loteId: LOTE, ...extra })

  it("descuenta con control de saldo y guarda potrero y grupo alimentado", async () => {
    m.reservaFirst.mockResolvedValue(reserva())
    m.sector.mockResolvedValue({ tipo: "potrero" }); m.lote.mockResolvedValue({ id: LOTE })
    const row = await registrarMovimiento(tx, ctx, CAMPO, consumo())
    expect(m.reservaUpd).toHaveBeenCalledWith({ where: { id: RESERVA, establecimientoId: CAMPO, stock: { gte: "15" } }, data: { stock: { decrement: "15" } } })
    expect(row).toMatchObject({ concepto: "consumo", sectorId: POTRERO, loteId: LOTE, motivo: "Consumo" })
  })

  it("rechaza consumos mayores al saldo y destinos de otro campo", async () => {
    m.reservaFirst.mockResolvedValue(reserva())
    m.sector.mockResolvedValue({ tipo: "potrero" }); m.lote.mockResolvedValue({ id: LOTE })
    m.reservaUpd.mockResolvedValueOnce({ count: 0 })
    await expect(registrarMovimiento(tx, ctx, CAMPO, consumo())).rejects.toMatchObject({ status: 409 })
    m.sector.mockResolvedValueOnce(null)
    await expect(registrarMovimiento(tx, ctx, CAMPO, consumo())).rejects.toThrow(/no pertenece a este campo/)
    m.lote.mockResolvedValueOnce(null)
    await expect(registrarMovimiento(tx, ctx, CAMPO, consumo())).rejects.toThrow(/grupo alimentado/)
    expect(m.movCreate).not.toHaveBeenCalled()
  })

  it("el potrero y el grupo solo se aceptan en un consumo", async () => {
    await expect(registrarMovimiento(tx, ctx, CAMPO, consumo({ tipo: "entrada", concepto: "compra" }))).rejects.toThrow(/solo en un consumo/)
    await expect(registrarMovimiento(tx, ctx, CAMPO, consumo({ concepto: "compra", sectorId: null, loteId: null }))).rejects.toThrow(/concepto/)
  })
})

describe("transferencia entre galpones", () => {
  const transf = (extra: object = {}) => ({ establecimientoId: CAMPO, clave: CLAVE, reservaId: RESERVA, depositoDestinoId: GALPON2, cantidad: "20", fecha: "2026-01-15", ...extra })

  it("salida y entrada atómicas con el mismo transferenciaId; crea la reserva en destino si no existe", async () => {
    m.reservaFirst.mockResolvedValue(reserva())
    m.sector.mockResolvedValue({ id: GALPON2, nombre: "Galpón Chico" })
    m.reservaMany.mockResolvedValue([])
    const r = await transferirForraje(tx, ctx, CAMPO, transf())
    expect(m.reservaCreate.mock.calls[0][0].data).toMatchObject({ depositoId: GALPON2, forrajeId: "alfalfa", unidad: "fardos", cultivoId: CULTIVO, nombre: "Fardos alfalfa", minimo: 0 })
    const [salida, entrada] = m.movCreate.mock.calls.map((c) => c[0].data)
    expect(salida).toMatchObject({ reservaId: RESERVA, tipo: "salida", concepto: "transferencia", clave: CLAVE, motivo: "Transferencia a Galpón Chico" })
    expect(entrada).toMatchObject({ reservaId: "nueva", tipo: "entrada", concepto: "transferencia", motivo: "Transferencia desde Galpón Principal" })
    expect(salida.transferenciaId).toBe(entrada.transferenciaId)
    expect(entrada.clave).not.toBe(CLAVE)
    expect(r.reservaDestinoId).toBe("nueva")
  })

  it("usa la reserva existente del mismo forraje y unidad; no registra nada si falta saldo", async () => {
    m.reservaFirst.mockResolvedValue(reserva())
    m.sector.mockResolvedValue({ id: GALPON2, nombre: "Galpón Chico" })
    m.reservaMany.mockResolvedValue([{ id: "otra", cultivoId: null }, { id: "misma-campana", cultivoId: CULTIVO }])
    await transferirForraje(tx, ctx, CAMPO, transf())
    expect(m.reservaCreate).not.toHaveBeenCalled()
    expect(m.movCreate.mock.calls[1][0].data.reservaId).toBe("misma-campana")

    vi.clearAllMocks(); m.movUnique.mockResolvedValue(null)
    m.reservaUpd.mockResolvedValueOnce({ count: 0 })
    await expect(transferirForraje(tx, ctx, CAMPO, transf())).rejects.toMatchObject({ status: 409 })
    expect(m.movCreate).not.toHaveBeenCalled()
  })

  it("rechaza transferir al mismo galpón o a un galpón de otro campo", async () => {
    m.reservaFirst.mockResolvedValue(reserva())
    m.sector.mockResolvedValueOnce({ id: GALPON, nombre: "Galpón Principal" })
    await expect(transferirForraje(tx, ctx, CAMPO, transf({ depositoDestinoId: GALPON }))).rejects.toThrow(/ya está en ese galpón/)
    m.sector.mockResolvedValueOnce(null)
    await expect(transferirForraje(tx, ctx, CAMPO, transf())).rejects.toMatchObject({ status: 404 })
  })
})

describe("totales por unidad", () => {
  it("no mezcla fardos, rollos y kg", () => {
    expect(totalesPorUnidad([{ cantidad: D(30), unidad: "rollos" }, { cantidad: "1000", unidad: "kg" }, { cantidad: D("12.5"), unidad: "kg" }, { cantidad: "5", unidad: "rollos" }]))
      .toEqual([{ unidad: "kg", cantidad: "1012.5" }, { unidad: "rollos", cantidad: "35" }])
  })
})
