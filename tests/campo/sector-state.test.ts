import { describe, expect, it } from "vitest"
import { sectorState, isParcel, livestockTypes, waterLabel } from "../../lib/mapa/sector-state"
import { geometrySchema, areaHa } from "../../lib/mapa/geometry"
import { parseMapImport } from "../../lib/mapa/import"
const empty = { tipo: "potrero", bovinos: 0, ovinos: 0, forrajes: [] }
describe("Estados y usos del lugar", () => {
  it("reconoce ocupación bovina u ovina sin necesitar un evento de pastoreo", () => {
    expect(sectorState({ ...empty, bovinos: 10 }).key).toBe("ocupado")
    expect(sectorState({ ...empty, ovinos: 20 }).key).toBe("ocupado")
  })
  it("distingue falta de registro de un descanso declarado", () => {
    expect(sectorState(empty).label).toBe("Sin ganado registrado")
    expect(sectorState({ ...empty, descanso: { estado: "inicio" } }).key).toBe("descanso")
    expect(sectorState({ ...empty, descanso: { estado: "fin" } }).key).toBe("sin-ganado")
  })
  it("una campaña no convierte una instalación en otra parcela", () => {
    expect(isParcel("galpon")).toBe(false); expect(isParcel("limite")).toBe(false)
    expect(livestockTypes.has("aguada")).toBe(false)
    expect(sectorState({ ...empty, forrajes: [{ nombre: "Alfalfa" }] }).key).toBe("cultivado")
  })
  it("no interpreta falta de revisión como falta de agua", () => {
    expect(waterLabel(null)).toBe("Sin revisión registrada")
    expect(waterLabel({ estado: "sin_agua" })).toBe("Sin agua")
  })
})
describe("Importación revisable de mapas", () => {
  it("acepta caminos y puntos sin inventar hectáreas", () => {
    const features = parseMapImport(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[-69,-45],[-68,-45]] }, properties: { name: "Camino" } }, { type: "Feature", geometry: { type: "Point", coordinates: [-69,-45] }, properties: { nombre: "Tranquera" } }] }), "campo.geojson")
    expect(features.map(f => f.nombre)).toEqual(["Camino", "Tranquera"])
    expect(areaHa(features[0].geometry)).toBeNull()
  })
  it("rechaza límites mal formados en vez de importar sólo una parte", () => {
    expect(() => parseMapImport('{"type":"FeatureCollection","features":[]}', "campo.json")).toThrow()
    expect(() => parseMapImport(JSON.stringify({ type: "LineString", coordinates: [[-69,-45],[-69,-45]] }), "campo.json")).toThrow()
    expect(() => parseMapImport("x".repeat(1000001), "campo.kml")).toThrow()
    expect(geometrySchema.safeParse({ type: "LineString", coordinates: [[0,91],[1,1]] }).success).toBe(false)
  })
})
