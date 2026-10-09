import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  producto: vi.fn(), movUnique: vi.fn(), movCreate: vi.fn(), proveedor: vi.fn(), loteFirst: vi.fn(), loteCreate: vi.fn(),
  cuenta: vi.fn(), finCreate: vi.fn(), audit: vi.fn(), sector: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    producto: { findFirst: m.producto },
    movimientoStock: { findUnique: m.movUnique, create: m.movCreate },
    proveedor: { findFirst: m.proveedor },
    loteProducto: { findFirst: m.loteFirst, create: m.loteCreate },
    cuentaFinanciera: { findFirst: m.cuenta },
    movimientoFinanciero: { create: m.finCreate },
    auditLog: { create: m.audit },
    sector: { findFirst: m.sector },
  }
  return { prisma: { $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { Prisma } from "@prisma/client"
import { categoriaEgreso, registrarCompra } from "@/lib/inventario/compras"
import { sumarValores, valorizarProducto } from "@/lib/inventario/valorizacion"
import { textoValores } from "@/lib/inventario/formato-valor"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const PROD = uuid(1), CUENTA = uuid(2), PROV = uuid(3)
const ctx = {
  userId: "u1", organizacionIds: ["o1"], organizacionDeEstablecimiento: { est1: "o1", est2: "o2" },
  organizacionIdsConRol: () => ["o1"], establecimientoIdsConRol: () => ["est1", "est2"],
} as unknown as AuthContext
const D = (n: number) => new Prisma.Decimal(n)
const compra = (extra: object = {}) => ({ clave: uuid(9), productoId: PROD, cantidad: "10", costoTotal: "1500", moneda: "ARS", fecha: "2026-10-01", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.producto.mockResolvedValue({ id: PROD, nombre: "Ivermectina", tipo: "antiparasitario", unidad: "ml", organizacionId: "o1", activo: true })
  m.movUnique.mockResolvedValue(null)
  m.loteFirst.mockResolvedValue(null)
  m.loteCreate.mockImplementation(async ({ data }) => ({ id: "L1", ...data }))
  m.movCreate.mockImplementation(async ({ data }) => ({ id: "M1", ...data }))
  m.finCreate.mockImplementation(async ({ data }) => ({ id: "F1", ...data }))
  m.proveedor.mockResolvedValue({ id: PROV, nombre: "Agro SA", cuit: "30-1" })
})

describe("compras de insumos", () => {
  it("entra al stock como lote con costo por unidad y moneda", async () => {
    const r = await registrarCompra(ctx, compra({ proveedorId: PROV, nroLote: "A-7" }))
    expect(m.loteCreate.mock.calls[0][0].data).toMatchObject({ nroLote: "A-7", proveedorId: PROV, proveedor: "Agro SA", moneda: "ARS" })
    expect(m.loteCreate.mock.calls[0][0].data.costo.toNumber()).toBe(150)
    expect(m.movCreate.mock.calls[0][0].data).toMatchObject({ tipo: "entrada", loteProductoId: "L1", origenTipo: "compra", origenId: null, clave: uuid(9) })
    expect(m.finCreate).not.toHaveBeenCalled()
    expect(r.repetido).toBe(false)
  })
  it("con cuenta genera el egreso vinculado, con la categoría del insumo", async () => {
    m.cuenta.mockResolvedValue({ id: CUENTA, nombre: "Banco", activa: true, moneda: "ARS", establecimientoId: "est1" })
    const r = await registrarCompra(ctx, compra({ proveedorId: PROV, egreso: { cuentaId: CUENTA, medioPago: "transferencia" } }))
    expect(m.finCreate.mock.calls[0][0].data).toMatchObject({ tipo: "egreso", categoria: "sanidad", establecimientoId: "est1", cuentaId: CUENTA, contraparte: "Agro SA", medioPago: "transferencia" })
    expect(m.finCreate.mock.calls[0][0].data.importe.toNumber()).toBe(1500)
    expect(m.movCreate.mock.calls[0][0].data.origenId).toBe("F1")
    expect(r.egresoId).toBe("F1")
  })
  it("no mezcla monedas ni usa cuentas de otra organización o desactivadas", async () => {
    m.cuenta.mockResolvedValueOnce({ id: CUENTA, nombre: "Caja USD", activa: true, moneda: "USD", establecimientoId: "est1" })
    await expect(registrarCompra(ctx, compra({ egreso: { cuentaId: CUENTA } }))).rejects.toThrow(/misma moneda/)
    m.cuenta.mockResolvedValueOnce({ id: CUENTA, nombre: "Otra", activa: true, moneda: "ARS", establecimientoId: "est2" })
    await expect(registrarCompra(ctx, compra({ egreso: { cuentaId: CUENTA } }))).rejects.toThrow(/organización del producto/)
    m.cuenta.mockResolvedValueOnce({ id: CUENTA, nombre: "Vieja", activa: false, moneda: "ARS", establecimientoId: "est1" })
    await expect(registrarCompra(ctx, compra({ egreso: { cuentaId: CUENTA } }))).rejects.toThrow(/desactivada/)
    expect(m.finCreate).not.toHaveBeenCalled()
    expect(m.movCreate).not.toHaveBeenCalled()
  })
  it("valida proveedor, fecha y lote repetido", async () => {
    m.proveedor.mockResolvedValueOnce(null)
    await expect(registrarCompra(ctx, compra({ proveedorId: PROV }))).rejects.toMatchObject({ status: 404 })
    await expect(registrarCompra(ctx, compra({ fecha: "2999-01-01" }))).rejects.toThrow(/fecha futura/)
    m.loteFirst.mockResolvedValueOnce({ id: "X" })
    await expect(registrarCompra(ctx, compra({ nroLote: "A-7" }))).rejects.toMatchObject({ status: 409 })
  })
  it("un reintento con la misma clave no duplica", async () => {
    m.movUnique.mockResolvedValue({ id: "M1", productoId: PROD, origenTipo: "compra", origenId: "F1", cantidad: D(10), loteProducto: { id: "L1" } })
    const r = await registrarCompra(ctx, compra())
    expect(r).toMatchObject({ repetido: true, egresoId: "F1" })
    expect(m.loteCreate).not.toHaveBeenCalled()
    m.movUnique.mockResolvedValue({ id: "M1", productoId: PROD, origenTipo: "compra", cantidad: D(3), loteProducto: null })
    await expect(registrarCompra(ctx, compra())).rejects.toMatchObject({ status: 409 })
  })
  it("categoría del egreso según el tipo de insumo", () => {
    expect(categoriaEgreso("vacuna")).toBe("sanidad")
    expect(categoriaEgreso("mineral")).toBe("alimentacion")
    expect(categoriaEgreso("agroquimico")).toBe("semillas_agroquimicos")
    expect(categoriaEgreso("combustible")).toBe("combustible")
    expect(categoriaEgreso("repuesto")).toBe("mantenimiento")
    expect(categoriaEgreso("otro")).toBe("otros_egresos")
  })
})

describe("valorización", () => {
  const producto = { costoReferencia: D(100), monedaCosto: "ARS", lotes: [{ id: "L1", costo: D(2), moneda: "USD" }, { id: "L2", costo: null, moneda: "ARS" }, { id: "L3", costo: D(50), moneda: "ARS" }] }
  it("valora cada lote por su costo y moneda, y lo demás por el costo de referencia", () => {
    const v = valorizarProducto(producto, new Map([["L1", D(10)], ["L2", D(3)], ["L3", D(-1)]]), D(2))
    // L1: 10 × USD 2 · L2 (sin costo): 3 × ARS 100 · sin lote: 2 × ARS 100 · L3 negativo no suma
    expect(v).toEqual({ valores: { USD: 20, ARS: 500 }, sinCosto: 0 })
  })
  it("sin costo de referencia informa la cantidad sin valorizar", () => {
    const v = valorizarProducto({ ...producto, costoReferencia: null }, new Map([["L1", D(1)], ["L2", D(3)]]), D(2))
    expect(v).toEqual({ valores: { USD: 2 }, sinCosto: 5 })
  })
  it("los totales nunca mezclan monedas", () => {
    expect(sumarValores([{ ARS: 100.1, USD: 5 }, { ARS: 0.2 }, {}])).toEqual({ ARS: 100.3, USD: 5 })
    expect(textoValores({ ARS: 1234.5, USD: 20 })).toBe("ARS 1.234,50 · USD 20,00")
    expect(textoValores({})).toBe("—")
  })
})
