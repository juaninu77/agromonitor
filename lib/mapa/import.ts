import { geometrySchema, type Geometry } from "./geometry"
export interface ImportedPlace { nombre: string; geometry: Geometry }
export function parseMapImport(text: string, filename: string): ImportedPlace[] {
  if (text.length > 1000000) throw Error("El archivo debe pesar menos de 1 MB")
  let features: { nombre: string; geometry: unknown }[]
  if (filename.toLowerCase().endsWith(".kml")) {
    const xml = new DOMParser().parseFromString(text, "application/xml")
    if (xml.getElementsByTagName("parsererror").length || /<!DOCTYPE|<!ENTITY/i.test(text)) throw Error("KML inválido")
    features = Array.from(xml.getElementsByTagNameNS("*", "Placemark")).map((p, i) => {
      const geometries = Array.from(p.querySelectorAll("Point, Polygon, LineString"))
      if (geometries.length !== 1) throw Error(`El lugar ${i + 1} debe tener una sola figura simple`)
      const g = geometries[0], type = g.localName
      if (g.querySelector("innerBoundaryIs")) throw Error("Los polígonos con huecos todavía no se pueden importar")
      const pairs = (g.querySelector("coordinates")?.textContent ?? "").trim().split(/\s+/).map(v => v.split(",").slice(0, 2).map(Number))
      return { nombre: p.getElementsByTagNameNS("*", "name")[0]?.textContent?.trim() || `Lugar ${i + 1}`, geometry: { type, coordinates: type === "Polygon" ? [pairs] : type === "Point" ? pairs[0] : pairs } }
    })
  } else {
    const raw = JSON.parse(text)
    const list = raw.type === "FeatureCollection" ? raw.features : raw.type === "Feature" ? [raw] : [{ geometry: raw }]
    if (!Array.isArray(list)) throw Error("GeoJSON inválido")
    features = list.map((f, i) => ({ nombre: String(f.properties?.nombre ?? f.properties?.name ?? `Lugar ${i + 1}`), geometry: f.geometry }))
  }
  if (!features.length || features.length > 100) throw Error("Importá entre 1 y 100 lugares por archivo")
  return features.map((f, i) => { const parsed = geometrySchema.safeParse(f.geometry); if (!parsed.success) throw Error(`Lugar ${i + 1}: ${parsed.error.issues[0].message}`); return { nombre: f.nombre.slice(0, 120), geometry: parsed.data } })
}
