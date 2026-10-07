import { describe, expect, it } from "vitest"
import { versionesDeLimites } from "@/lib/mapa/historial"

const sq = (d: number) => ({ type: "Polygon" as const, coordinates: [[[-69, -45], [-69 + d, -45], [-69 + d, -45 + d], [-69, -45 + d], [-69, -45]]] })
const fila = (i: number, detalle: object) => ({ id: `a${i}`, fecha: new Date(2026, 0, i), detalle, usuario: { nombre: "Ana", apellido: "Paz" } })

describe("historial de límites", () => {
  it("reconstruye original, ediciones y división; marca la vigente y omite cambios sin geometría", () => {
    const v = versionesDeLimites([
      fila(1, { geometriaAnterior: sq(0.01), geometriaNueva: sq(0.02) }),
      fila(2, { cambios: ["capacidad"] }),
      fila(3, { division: true, geometriaAnterior: sq(0.02), geometriaNueva: sq(0.015) }),
    ], sq(0.015))
    expect(v.map((x) => x.motivo)).toEqual(["division", "edicion", "original"])
    expect(v[0]).toMatchObject({ actual: true, autor: "Ana Paz" })
    expect(v[2].areaHa).toBeGreaterThan(80)
  })
  it("sin cambios de geometría devuelve vacío", () => {
    expect(versionesDeLimites([fila(1, { cambios: ["nombre"] })], null)).toEqual([])
  })
})
