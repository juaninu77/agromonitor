import { describe, expect, it } from "vitest"
import { areaHa, geometrySchema, polygonFrom, sectorSchema } from "@/lib/mapa/geometry"

const square = polygonFrom([[-69, -45], [-68.99, -45], [-68.99, -44.99], [-69, -44.99]])!
describe("Geometría de lugares", () => {
  it("calcula hectáreas geodésicas sin usar grados como metros", () => {
    expect(geometrySchema.safeParse(square).success).toBe(true)
    expect(areaHa(square)).toBeGreaterThan(87)
    expect(areaHa(square)).toBeLessThan(88)
  })
  it("acepta puntos de Sarmiento y Conesa sin inventar una superficie", () => {
    for (const coordinates of [[-69.0689, -45.5868], [-64.453, -40.106]]) {
      const value = geometrySchema.parse({ type: "Point", coordinates })
      expect(areaHa(value)).toBeNull()
    }
  })
  it.each([
    { type: "Point", coordinates: [-69, 91] },
    { type: "Point", coordinates: [181, -45] },
    { type: "Point", coordinates: [NaN, -45] },
    { type: "Point", coordinates: ["-69", "-45"] },
    { type: "Polygon", coordinates: [[[-69, -45], [-68, -45], [-68, -44]]] },
    { type: "Polygon", coordinates: [[[-69, -45], [-68, -44], [-69, -44], [-68, -45], [-69, -45]]] },
    { type: "Polygon", coordinates: [[[-69, -45], [-68, -45], [-67, -45], [-69, -45]]] },
    { type: "Polygon", coordinates: [[[-69, -45], [-68, -45], [-68, -44], [-68, -45], [-69, -45]]] },
    { type: "FeatureCollection", features: [] },
  ])("rechaza coordenadas, contornos abiertos, cruzados o vacíos: %j", value => {
    expect(geometrySchema.safeParse(value).success).toBe(false)
  })
  it("requiere al menos tres vértices antes de cerrar", () => {
    expect(polygonFrom([[-69, -45], [-68, -45]])).toBeNull()
  })
  it("permite dibujar sin reemplazar la superficie declarada", () => {
    const value = sectorSchema.parse({ nombre: "Potrero", tipo: "potrero", superficieHa: "95", geometria: square })
    expect(value.superficieHa).toBe(95)
    expect(areaHa(value.geometria)).not.toBe(95)
  })
  it("limita la complejidad y el contenido libre", () => {
    expect(geometrySchema.safeParse({ type: "Polygon", coordinates: [Array(502).fill([-69, -45])] }).success).toBe(false)
    expect(sectorSchema.safeParse({ nombre: " ", tipo: "galpon" }).success).toBe(false)
    expect(sectorSchema.safeParse({ nombre: "A", tipo: "galpon", capacidad: 0.5 }).success).toBe(false)
  })
})
