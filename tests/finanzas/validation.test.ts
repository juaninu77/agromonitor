import { describe, expect, it } from "vitest"
import { cuentaSchema, movimientoSchema, normalizarImporte, transferenciaSchema } from "@/lib/finanzas/validation"

const est = "00000000-0000-4000-8000-000000000001"
const cuenta = "00000000-0000-4000-8000-000000000002"
const base = { establecimientoId: est, cuentaId: cuenta, fecha: "2026-03-15", importe: "1500", descripcion: "Gasoil" }

describe("normalizarImporte", () => {
  it("acepta formato es-AR, punto decimal y números", () => {
    expect(normalizarImporte("1.234.567,89")).toBe("1234567.89")
    expect(normalizarImporte("$ 1500,5")).toBe("1500.5")
    expect(normalizarImporte("1500.25")).toBe("1500.25")
    expect(normalizarImporte(99.999)).toBe("100.00")
  })
})

describe("movimientoSchema", () => {
  it("acepta un gasto válido y normaliza CUIT y vacíos", () => {
    const r = movimientoSchema.parse({ ...base, tipo: "egreso", categoria: "combustible", cuit: "20-12345678-9", medioPago: "", notas: " " })
    expect(r).toMatchObject({ importe: "1500", cuit: "20123456789", medioPago: null, notas: null, comprobanteId: null })
  })
  it("rechaza importes cero, negativos o con 3 decimales", () => {
    for (const importe of ["0", "-5", "10.123", "abc"]) {
      expect(movimientoSchema.safeParse({ ...base, importe, tipo: "egreso", categoria: "combustible" }).success).toBe(false)
    }
  })
  it("la categoría debe corresponder al tipo", () => {
    const r = movimientoSchema.safeParse({ ...base, tipo: "ingreso", categoria: "combustible" })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toMatch(/Categoría inválida para un ingreso/)
  })
  it("los impuestos exigen detalle y el detalle solo aplica a impuestos", () => {
    expect(movimientoSchema.safeParse({ ...base, tipo: "egreso", categoria: "impuestos" }).success).toBe(false)
    expect(movimientoSchema.safeParse({ ...base, tipo: "egreso", categoria: "impuestos", subcategoria: "iva" }).success).toBe(true)
    expect(movimientoSchema.safeParse({ ...base, tipo: "egreso", categoria: "sanidad", subcategoria: "iva" }).success).toBe(false)
  })
  it("no permite crear transferencias como movimiento suelto", () => {
    expect(movimientoSchema.safeParse({ ...base, tipo: "egreso", categoria: "transferencia" }).success).toBe(false)
  })
  it("rechaza fechas inexistentes o muy lejanas", () => {
    for (const fecha of ["2026-02-30", "1999-12-31", "2099-01-01", "15/03/2026"]) {
      expect(movimientoSchema.safeParse({ ...base, fecha, tipo: "egreso", categoria: "sanidad" }).success).toBe(false)
    }
  })
  it("rechaza campos desconocidos", () => {
    expect(movimientoSchema.safeParse({ ...base, tipo: "egreso", categoria: "sanidad", creadoPorId: est }).success).toBe(false)
  })
})

describe("cuentaSchema", () => {
  it("aplica valores por defecto y admite saldo inicial negativo", () => {
    expect(cuentaSchema.parse({ establecimientoId: est, nombre: "Caja", tipo: "caja" })).toMatchObject({ moneda: "ARS", saldoInicial: "0", activa: true })
    expect(cuentaSchema.parse({ establecimientoId: est, nombre: "Visa", tipo: "tarjeta", saldoInicial: "-1500,50" }).saldoInicial).toBe("-1500.50")
  })
  it("rechaza tipo o moneda inválidos", () => {
    expect(cuentaSchema.safeParse({ establecimientoId: est, nombre: "X", tipo: "cripto" }).success).toBe(false)
    expect(cuentaSchema.safeParse({ establecimientoId: est, nombre: "X", tipo: "caja", moneda: "EUR" }).success).toBe(false)
  })
})

describe("transferenciaSchema", () => {
  it("exige dos cuentas distintas", () => {
    const r = transferenciaSchema.safeParse({ establecimientoId: est, cuentaOrigenId: cuenta, cuentaDestinoId: cuenta, fecha: "2026-03-01", importe: "10" })
    expect(r.success).toBe(false)
  })
})

describe("campos vacíos", () => {
  it("importe vacío pide el importe y saldo vacío vale 0", () => {
    const r = movimientoSchema.safeParse({ ...base, importe: "", tipo: "egreso", categoria: "sanidad" })
    expect(JSON.stringify(r.error?.issues)).toMatch(/El importe es requerido/)
    expect(cuentaSchema.parse({ establecimientoId: est, nombre: "Caja", tipo: "caja", saldoInicial: "" }).saldoInicial).toBe("0")
  })
})
