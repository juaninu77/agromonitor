import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
import { agregarResumen, mesesEntre } from "@/lib/finanzas/resumen"

describe("mesesEntre", () => {
  it("incluye ambos extremos y cruza el año", () => {
    expect(mesesEntre("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
  })
})

describe("agregarResumen", () => {
  it("separa por moneda, rellena meses vacíos y suma impuestos", () => {
    const r = agregarResumen(
      [
        { mes: "2026-01", moneda: "ARS", tipo: "ingreso", categoria: "venta_hacienda", subcategoria: null, total: "1000000.10" },
        { mes: "2026-01", moneda: "ARS", tipo: "egreso", categoria: "impuestos", subcategoria: "iva", total: "210000" },
        { mes: "2026-03", moneda: "ARS", tipo: "egreso", categoria: "impuestos", subcategoria: "iva", total: "50000.20" },
        { mes: "2026-03", moneda: "ARS", tipo: "egreso", categoria: "combustible", subcategoria: null, total: "300000" },
        { mes: "2026-02", moneda: "USD", tipo: "egreso", categoria: "honorarios", subcategoria: null, total: "500" },
      ],
      "2026-01-01",
      "2026-03-31",
    )
    expect(r.totales.ARS).toEqual({ ingresos: 1000000.1, egresos: 560000.2, resultado: 439999.9 })
    expect(r.totales.USD).toEqual({ ingresos: 0, egresos: 500, resultado: -500 })
    const ars = r.mensual.filter((m) => m.moneda === "ARS")
    expect(ars.map((m) => m.mes)).toEqual(["2026-01", "2026-02", "2026-03"])
    expect(ars[1]).toMatchObject({ ingresos: 0, egresos: 0 })
    expect(r.impuestos).toEqual([{ subcategoria: "iva", moneda: "ARS", total: 260000.2 }])
    expect(r.porCategoria[0]).toMatchObject({ categoria: "venta_hacienda", total: 1000000.1 })
  })
  it("sin filas devuelve ceros en pesos", () => {
    const r = agregarResumen([], "2026-01-01", "2026-01-31")
    expect(r.totales).toEqual({ ARS: { ingresos: 0, egresos: 0, resultado: 0 } })
    expect(r.mensual).toHaveLength(1)
  })
})
