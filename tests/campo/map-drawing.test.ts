import { describe, expect, it } from "vitest"
import { areaHa, geometrySchema, polygonFrom, type Position } from "@/lib/mapa/geometry"
import {
  distanciaM,
  dividirPoligono,
  DivisionError,
  formaPorTipo,
  formatearDistancia,
  perimetroM,
  rectanguloDesde3Puntos,
} from "@/lib/mapa/drawing"

// Cuadrado de ~1 km de lado cerca de Sarmiento (Chubut)
const lon0 = -69.07, lat0 = -45.59
const dLon = 1000 / (111_320 * Math.cos((lat0 * Math.PI) / 180)), dLat = 1000 / 110_540
const cuadrado: Position[] = [[lon0, lat0], [lon0 + dLon, lat0], [lon0 + dLon, lat0 + dLat], [lon0, lat0 + dLat]]
const ha = (v: Position[]) => areaHa(polygonFrom(v))!

describe("formas por tipo", () => {
  it("corrales y galpones se dibujan como área, caminos y alambrados como línea", () => {
    expect(formaPorTipo("corral")).toBe("Rectangle")
    expect(formaPorTipo("manga")).toBe("Rectangle")
    expect(formaPorTipo("potrero")).toBe("Polygon")
    expect(formaPorTipo("alambrado")).toBe("LineString")
    expect(formaPorTipo("tranquera")).toBe("Point")
    expect(formaPorTipo("desconocido")).toBe("Polygon")
  })
})

describe("medidas", () => {
  it("mide distancias y perímetros en metros", () => {
    expect(distanciaM(cuadrado[0], cuadrado[1])).toBeCloseTo(1000, -1)
    expect(perimetroM(cuadrado)).toBeGreaterThan(3980)
    expect(perimetroM(cuadrado)).toBeLessThan(4020)
    expect(formatearDistancia(850.4)).toBe("850 m")
    expect(formatearDistancia(1250)).toBe("1,25 km")
  })
})

describe("rectángulo de tres clics", () => {
  it("arma un rectángulo rotado con el ancho perpendicular al primer lado", () => {
    const a: Position = [lon0, lat0]
    // Lado de ~50 m a 45° y ancho de ~20 m
    const b: Position = [lon0 + (35.36 / 1000) * dLon, lat0 + (35.36 / 1000) * dLat]
    const c: Position = [b[0] - (14.14 / 1000) * dLon, b[1] + (14.14 / 1000) * dLat]
    const r = rectanguloDesde3Puntos(a, b, c)!
    expect(r).toHaveLength(4)
    expect(distanciaM(r[0], r[1])).toBeCloseTo(50, 0)
    expect(distanciaM(r[1], r[2])).toBeCloseTo(20, 0)
    expect(distanciaM(r[0], r[2])).toBeCloseTo(Math.hypot(50, 20), 0)
    expect(geometrySchema.safeParse(polygonFrom(r)).success).toBe(true)
    expect(ha(r)).toBeCloseTo(0.1, 2)
  })
  it("devuelve null si los clics no forman superficie", () => {
    expect(rectanguloDesde3Puntos(cuadrado[0], cuadrado[0], cuadrado[2])).toBeNull()
    expect(rectanguloDesde3Puntos(cuadrado[0], cuadrado[1], [lon0 + dLon / 2, lat0])).toBeNull()
  })
})

describe("dividir un potrero", () => {
  it("corta con una línea recta en dos partes que suman la superficie original", () => {
    const linea: Position[] = [[lon0 + dLon * 0.3, lat0 - dLat * 0.1], [lon0 + dLon * 0.3, lat0 + dLat * 1.1]]
    const { partes, corte } = dividirPoligono(cuadrado, linea)
    const [a, b] = partes.map(ha)
    expect(a + b).toBeCloseTo(ha(cuadrado), 1)
    expect(Math.min(a, b) / ha(cuadrado)).toBeCloseTo(0.3, 1)
    for (const p of partes) expect(geometrySchema.safeParse(polygonFrom(p)).success).toBe(true)
    expect(corte).toHaveLength(2)
    expect(Math.abs(distanciaM(corte[0], corte[1]) - 1000)).toBeLessThan(10)
  })
  it("respeta los quiebres de la línea dentro del potrero", () => {
    const linea: Position[] = [
      [lon0 - dLon * 0.1, lat0 + dLat * 0.5],
      [lon0 + dLon * 0.5, lat0 + dLat * 0.8],
      [lon0 + dLon * 1.1, lat0 + dLat * 0.5],
    ]
    const { partes, corte } = dividirPoligono(cuadrado, linea)
    expect(corte).toHaveLength(3)
    expect(partes.map(ha).reduce((s, x) => s + x, 0)).toBeCloseTo(ha(cuadrado), 1)
    for (const p of partes) expect(geometrySchema.safeParse(polygonFrom(p)).success).toBe(true)
  })
  it("corta una esquina (línea entre dos lados contiguos)", () => {
    const linea: Position[] = [[lon0 + dLon * 0.8, lat0 - dLat * 0.1], [lon0 + dLon * 1.1, lat0 + dLat * 0.2]]
    const { partes } = dividirPoligono(cuadrado, linea)
    const [a, b] = partes.map(ha).sort((x, y) => x - y)
    expect(a).toBeLessThan(ha(cuadrado) * 0.05)
    expect(a + b).toBeCloseTo(ha(cuadrado), 1)
  })
  it("acepta una línea que termina justo sobre el borde (imán)", () => {
    const linea: Position[] = [[lon0 + dLon * 0.5, lat0], [lon0 + dLon * 0.5, lat0 + dLat]]
    const { partes } = dividirPoligono(cuadrado, linea)
    expect(partes.map(ha)[0]).toBeCloseTo(ha(cuadrado) / 2, 1)
  })
  it("rechaza líneas que no cruzan el contorno de lado a lado", () => {
    const adentro: Position[] = [[lon0 + dLon * 0.2, lat0 + dLat * 0.2], [lon0 + dLon * 0.8, lat0 + dLat * 0.8]]
    expect(() => dividirPoligono(cuadrado, adentro)).toThrow(DivisionError)
    const afuera: Position[] = [[lon0 - dLon, lat0 - dLat], [lon0 - dLon * 0.5, lat0 - dLat * 0.2]]
    expect(() => dividirPoligono(cuadrado, afuera)).toThrow(/de lado a lado/)
  })
})
