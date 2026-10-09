import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
import { Prisma } from "@prisma/client"
import { alertasInventario, avisarStockBajo } from "@/lib/inventario/alertas"
import { descontarAplicacion, revertirAplicaciones } from "@/lib/inventario/aplicaciones"
import { consumoSugerido } from "@/lib/inventario/consumo"

const D = (n: number) => new Prisma.Decimal(n)
const PROD = "p1"
// Stock del producto: `lotes` reparte el saldo por lote (el resto queda sin lote)
let stock = 0
let lotes: Record<string, number> = {}
const tx = {
  producto: { findUnique: vi.fn(), findMany: vi.fn() },
  loteProducto: { findFirst: vi.fn(), findMany: vi.fn() },
  sector: { findMany: vi.fn() },
  movimientoStock: {
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(async (q: { by: string[] }) => {
      if (q.by.includes("loteProductoId")) {
        const sinLote = stock - Object.values(lotes).reduce((a, b) => a + b, 0)
        return [...Object.entries(lotes).map(([id, n]) => ({ productoId: PROD, loteProductoId: id, tipo: "entrada", _sum: { cantidad: D(n) } })), { productoId: PROD, loteProductoId: null, tipo: "entrada", _sum: { cantidad: D(sinLote) } }]
      }
      if (q.by.includes("sectorId")) return [{ sectorId: null, tipo: "entrada", _sum: { cantidad: D(stock) } }]
      return [{ productoId: PROD, tipo: "entrada", _sum: { cantidad: D(stock) } }]
    }),
  },
  membresia: { findMany: vi.fn() },
  notificacion: { findMany: vi.fn(), createMany: vi.fn() },
}
const db = tx as unknown as Prisma.TransactionClient
const desc = (extra: object = {}) => ({ productoId: PROD, cantidad: 10, fecha: new Date(), motivo: "Aplicación", origenTipo: "sanidad" as const, origenId: "e1", ...extra })
const ctx = { establecimientoIds: ["est1"], estricto: true }

beforeEach(() => {
  vi.clearAllMocks()
  stock = 100; lotes = {}
  tx.producto.findUnique.mockResolvedValue({ id: PROD, nombre: "Ivermectina", unidad: "ml", organizacionId: "o1" })
  tx.producto.findMany.mockResolvedValue([])
  tx.loteProducto.findMany.mockResolvedValue([])
  tx.sector.findMany.mockResolvedValue([])
  tx.membresia.findMany.mockResolvedValue([{ usuarioId: "u1" }, { usuarioId: "u2" }])
  tx.notificacion.findMany.mockResolvedValue([])
})

describe("consumo sugerido", () => {
  it("convierte la dosis a la unidad del producto", () => {
    expect(consumoSugerido("ml", 5, "ml", 20)).toBe(100)
    expect(consumoSugerido("ml", 5, "cc", 20)).toBe(100)
    expect(consumoSugerido("litros", 5, "ml", 200)).toBe(1)
    expect(consumoSugerido("dosis", 2, "ml", 30)).toBe(30)
    expect(consumoSugerido("comprimidos", 2, "comprimido", 3)).toBe(6)
  })
  it("sin dosis o con unidades incompatibles no sugiere", () => {
    expect(consumoSugerido("ml", null, "ml", 10)).toBeNull()
    expect(consumoSugerido("kg", 5, "ml", 10)).toBeNull()
  })
})

describe("descuento de una aplicación", () => {
  it("descuenta en la unidad del producto y queda vinculado al evento", async () => {
    const r = await descontarAplicacion(db, desc(), ctx)
    expect(r).toMatchObject({ descontado: 10, faltante: 0, unidad: "ml" })
    expect(tx.movimientoStock.create.mock.calls[0][0].data).toMatchObject({ productoId: PROD, tipo: "salida", origenTipo: "sanidad", origenId: "e1" })
  })
  it("Sanidad (estricto) rechaza si no alcanza el stock", async () => {
    stock = 4
    await expect(descontarAplicacion(db, desc(), ctx)).rejects.toMatchObject({ status: 409 })
    expect(tx.movimientoStock.create).not.toHaveBeenCalled()
  })
  it("Manga (no estricto) descuenta lo que hay y devuelve el faltante", async () => {
    stock = 4
    const r = await descontarAplicacion(db, desc({ origenTipo: "manga" }), { ...ctx, estricto: false })
    expect(r).toMatchObject({ descontado: 4, faltante: 6 })
    stock = 0
    const sin = await descontarAplicacion(db, desc({ origenTipo: "manga" }), { ...ctx, estricto: false })
    expect(sin).toMatchObject({ descontado: 0, faltante: 10 })
  })
  it("un lote vencido pide confirmación, salvo que se acepte", async () => {
    lotes = { L1: 50 }
    tx.loteProducto.findFirst.mockResolvedValue({ id: "L1", nroLote: "A-1", vencimiento: new Date("2020-01-31T00:00:00Z") })
    await expect(descontarAplicacion(db, desc({ loteProductoId: "L1" }), ctx)).rejects.toMatchObject({ status: 409, codigo: "lote_vencido" })
    await descontarAplicacion(db, desc({ loteProductoId: "L1" }), { ...ctx, aceptarVencido: true })
    expect(tx.movimientoStock.create.mock.calls[0][0].data).toMatchObject({ loteProductoId: "L1" })
  })
  it("informa de qué lotes salió (para el costo)", async () => {
    const r = await descontarAplicacion(db, desc(), ctx)
    expect(r.lotes).toEqual([{ loteProductoId: null, cantidad: 10 }])
  })
  it("anular devuelve cada salida con una entrada enlazada", async () => {
    tx.movimientoStock.findMany.mockResolvedValue([
      { id: "m1", productoId: PROD, loteProductoId: "L1", sectorId: null, cantidad: D(4), origenId: "e1" },
      { id: "m2", productoId: PROD, loteProductoId: null, sectorId: "g1", cantidad: D(1), origenId: "e1" },
    ])
    const r = await revertirAplicaciones(db, ["e1"], "error de carga")
    expect(tx.movimientoStock.findMany.mock.calls[0][0].where).toMatchObject({ origenTipo: "sanidad", origenId: { in: ["e1"] }, tipo: "salida", anulaAId: null, anuladoPor: null })
    const filas = tx.movimientoStock.create.mock.calls.map((c) => c[0].data)
    expect(filas).toEqual([
      expect.objectContaining({ tipo: "entrada", anulaAId: "m1", loteProductoId: "L1", motivo: "Anulación: error de carga" }),
      expect.objectContaining({ tipo: "entrada", anulaAId: "m2", sectorId: "g1" }),
    ])
    expect(filas[0].operacionId).toBe(filas[1].operacionId)
    expect(r.revertido).toBe(5)
  })
  it("un lote de otro producto se rechaza", async () => {
    tx.loteProducto.findFirst.mockResolvedValue(null)
    await expect(descontarAplicacion(db, desc({ loteProductoId: "otro" }), ctx)).rejects.toMatchObject({ status: 400 })
  })
})

describe("avisos de stock bajo", () => {
  it("avisa a los gestores una sola vez mientras el aviso no se lea", async () => {
    stock = 3
    tx.producto.findMany.mockResolvedValue([{ id: PROD, nombre: "Ivermectina", unidad: "ml", stockMinimo: D(5), organizacionId: "o1" }])
    tx.notificacion.findMany.mockResolvedValue([{ usuarioId: "u1" }])
    await avisarStockBajo(db, [PROD])
    expect(tx.notificacion.createMany).toHaveBeenCalledTimes(1)
    expect(tx.notificacion.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ usuarioId: "u2", tipo: "stock_bajo", url: `/inventario/${PROD}` })])
  })
  it("sobre el mínimo no avisa", async () => {
    stock = 30
    tx.producto.findMany.mockResolvedValue([{ id: PROD, nombre: "Ivermectina", unidad: "ml", stockMinimo: D(5), organizacionId: "o1" }])
    await avisarStockBajo(db, [PROD])
    expect(tx.notificacion.createMany).not.toHaveBeenCalled()
  })
})

describe("alertas de inventario", () => {
  it("lista stock bajo y lotes con saldo vencidos o por vencer", async () => {
    stock = 8; lotes = { L1: 5, L2: 3, L3: 0 }
    const en = (dias: number) => new Date(Date.now() + dias * 86_400_000)
    tx.producto.findMany.mockResolvedValue([{ id: PROD, nombre: "Ivermectina", unidad: "ml", stockMinimo: D(10), organizacionId: "o1", lotes: [
      { id: "L1", nroLote: "A", vencimiento: en(-3) }, { id: "L2", nroLote: "B", vencimiento: en(200) }, { id: "L3", nroLote: "C", vencimiento: en(-10) },
    ] }])
    const r = await alertasInventario(db, ["o1"])
    expect(r.stockBajo).toEqual([expect.objectContaining({ productoId: PROD, stock: 8, minimo: 10 })])
    // L2 vence lejos y L3 no tiene saldo: solo L1
    expect(r.vencimientos.map((v) => v.loteId)).toEqual(["L1"])
    expect(tx.notificacion.createMany.mock.calls[0][0].data[0]).toMatchObject({ tipo: "vencimiento_producto", url: `/inventario/${PROD}?lote=L1` })
  })
})
