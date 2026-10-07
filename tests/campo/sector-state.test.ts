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
    const { lugares: features } = parseMapImport(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[-69,-45],[-68,-45]] }, properties: { name: "Camino" } }, { type: "Feature", geometry: { type: "Point", coordinates: [-69,-45] }, properties: { nombre: "Tranquera" } }] }), "campo.geojson")
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

describe("Importación: multipartes, huecos y KMZ", () => {
  const anillo = (x: number) => [[x, -45], [x + 0.01, -45], [x + 0.01, -44.99], [x, -44.99], [x, -45]]
  it("separa un MultiPolygon en varios lugares numerados", () => {
    const r = parseMapImport(JSON.stringify({ type: "Feature", properties: { name: "Lote" }, geometry: { type: "MultiPolygon", coordinates: [[anillo(-69)], [anillo(-68.9)]] } }), "c.geojson")
    expect(r.lugares.map(l => l.nombre)).toEqual(["Lote (1)", "Lote (2)"])
    expect(r.avisos).toEqual([])
  })
  it("importa el contorno exterior de un polígono con hueco y avisa", () => {
    const hueco = [[-68.996, -44.996], [-68.994, -44.996], [-68.994, -44.994], [-68.996, -44.996]]
    const r = parseMapImport(JSON.stringify({ type: "Polygon", coordinates: [anillo(-69), hueco] }), "c.json")
    expect(r.lugares).toHaveLength(1)
    expect(r.lugares[0].geometry.type === "Polygon" && r.lugares[0].geometry.coordinates).toHaveLength(1)
    expect(r.avisos[0]).toMatch(/1 hueco/)
  })
  it("lee el .kml de un KMZ (ZIP con deflate)", async () => {
    const { deflateRawSync } = await import("node:zlib")
    const { kmlDesdeKmz } = await import("../../lib/mapa/import")
    const kml = '<kml><Placemark><name>Potrero</name><Point><coordinates>-69,-45</coordinates></Point></Placemark></kml>'
    const nombre = Buffer.from("doc.kml"), datos = deflateRawSync(new Uint8Array(Buffer.from(kml)))
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(kml.length, 22); local.writeUInt16LE(nombre.length, 26)
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(datos.length, 20); central.writeUInt32LE(kml.length, 24); central.writeUInt16LE(nombre.length, 28); central.writeUInt32LE(0, 42)
    const inicioCentral = local.length + nombre.length + datos.length
    const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(central.length + nombre.length, 12); fin.writeUInt32LE(inicioCentral, 16)
    const zip = Buffer.concat([local, nombre, datos, central, nombre, fin] as unknown as Uint8Array[])
    expect(await kmlDesdeKmz(new Uint8Array(zip).buffer as ArrayBuffer)).toBe(kml)
  })
})
