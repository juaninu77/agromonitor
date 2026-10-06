import { describe, expect, it } from "vitest"
import { agregarFilas } from "@/lib/ganado/estadisticas"

describe("agregarFilas", () => {
  it("suma categorías, estados y promedios a partir de las filas agregadas en SQL", () => {
    const stats = agregarFilas([
      { categoria: "novillo", estado_vital: "activo", total: 10, con_peso: 8, suma_peso: 3200 },
      { categoria: "novillo", estado_vital: "vendido", total: 2, con_peso: 2, suma_peso: 900 },
      { categoria: "vaca", estado_vital: "activo", total: 5, con_peso: 0, suma_peso: 0 },
      { categoria: null, estado_vital: "activo", total: 1, con_peso: 1, suma_peso: 100 },
    ])
    expect(stats.total).toBe(18)
    expect(stats.activos).toBe(16)
    expect(stats.conPeso).toBe(11)
    expect(stats.pesoPromedio).toBe(Math.round(4200 / 11))
    expect(stats.porCategoria).toEqual({ novillo: 12, vaca: 5 })
    expect(stats.pesoPorCategoria).toEqual([
      { category: "novillo", count: 10, avgWeight: 410 },
      { category: "Sin categoría", count: 1, avgWeight: 100 },
    ])
  })
  it("con cero filas devuelve estadísticas vacías sin NaN", () => {
    const stats = agregarFilas([])
    expect(stats).toEqual({ total: 0, porCategoria: {}, pesoPromedio: 0, conPeso: 0, activos: 0, pesoPorCategoria: [] })
  })
})
