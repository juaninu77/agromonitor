import { geometrySchema, type Geometry } from "./geometry"

// Importación de límites desde Google Earth (KML/KMZ) o GeoJSON.
// - KMZ: es un ZIP con un .kml adentro; se abre con DecompressionStream (sin dependencias).
// - MultiGeometry / MultiPolygon / MultiLineString / MultiPoint: cada parte es un lugar.
// - Polígonos con huecos: se importa el contorno exterior y se avisa (el mapa no
//   maneja huecos; un hueco suele ser un monte o laguna que conviene dibujar aparte).

export interface ImportedPlace { nombre: string; geometry: Geometry }
export interface ResultadoImportacion { lugares: ImportedPlace[]; avisos: string[] }

const MAX_LUGARES = 100
type Par = [number, number]
interface Bruto { nombre: string; geometry: unknown }

const parsePares = (texto: string): Par[] =>
  texto.trim().split(/\s+/).filter(Boolean).map((v) => v.split(",").slice(0, 2).map(Number) as Par)

/** Separa una geometría GeoJSON en figuras simples (Point, LineString o Polygon de un anillo). */
function simples(g: { type?: string; coordinates?: unknown; geometries?: unknown[] } | null | undefined, nombre: string, avisos: string[]): Bruto[] {
  if (!g || typeof g !== "object") return [{ nombre, geometry: g }]
  const sinHuecos = (anillos: unknown): unknown => {
    if (Array.isArray(anillos) && anillos.length > 1) {
      avisos.push(`«${nombre}»: se ignoraron ${anillos.length - 1} ${anillos.length - 1 === 1 ? "hueco" : "huecos"} (se importó el contorno exterior)`)
      return [anillos[0]]
    }
    return anillos
  }
  switch (g.type) {
    case "Polygon":
      return [{ nombre, geometry: { type: "Polygon", coordinates: sinHuecos(g.coordinates) } }]
    case "MultiPolygon":
    case "MultiLineString":
    case "MultiPoint": {
      const tipo = g.type.replace("Multi", "")
      const partes = Array.isArray(g.coordinates) ? g.coordinates : []
      return partes.flatMap((c, i) => simples({ type: tipo, coordinates: c }, partes.length > 1 ? `${nombre} (${i + 1})` : nombre, avisos))
    }
    case "GeometryCollection": {
      const partes = Array.isArray(g.geometries) ? g.geometries : []
      return partes.flatMap((p, i) => simples(p as typeof g, partes.length > 1 ? `${nombre} (${i + 1})` : nombre, avisos))
    }
    default:
      return [{ nombre, geometry: g }]
  }
}

function desdeKml(texto: string, avisos: string[]): Bruto[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(texto)) throw Error("KML inválido")
  const xml = new DOMParser().parseFromString(texto, "application/xml")
  if (xml.getElementsByTagName("parsererror").length) throw Error("KML inválido")
  return Array.from(xml.getElementsByTagNameNS("*", "Placemark")).flatMap((p, i) => {
    const nombre = p.getElementsByTagNameNS("*", "name")[0]?.textContent?.trim() || `Lugar ${i + 1}`
    const figuras = Array.from(p.getElementsByTagNameNS("*", "*")).filter((el) => ["Point", "LineString", "Polygon"].includes(el.localName))
      // Los LinearRing y LineString dentro de un Polygon no son figuras propias
      .filter((el) => !el.parentElement || el.localName === "Polygon" || !el.closest("Polygon"))
    if (!figuras.length) return []
    return figuras.flatMap((g, j) => {
      const etiqueta = figuras.length > 1 ? `${nombre} (${j + 1})` : nombre
      const coords = (el: Element | null | undefined) => parsePares(el?.getElementsByTagNameNS("*", "coordinates")[0]?.textContent ?? "")
      if (g.localName === "Point") return [{ nombre: etiqueta, geometry: { type: "Point", coordinates: coords(g)[0] } }]
      if (g.localName === "LineString") return [{ nombre: etiqueta, geometry: { type: "LineString", coordinates: coords(g) } }]
      const exterior = coords(g.getElementsByTagNameNS("*", "outerBoundaryIs")[0])
      const huecos = g.getElementsByTagNameNS("*", "innerBoundaryIs").length
      return simples({ type: "Polygon", coordinates: [exterior, ...Array.from({ length: huecos }, () => [])] }, etiqueta, avisos)
    })
  })
}

function desdeGeoJson(texto: string, avisos: string[]): Bruto[] {
  const raw = JSON.parse(texto)
  const lista = raw.type === "FeatureCollection" ? raw.features : raw.type === "Feature" ? [raw] : [{ geometry: raw }]
  if (!Array.isArray(lista)) throw Error("GeoJSON inválido")
  return lista.flatMap((f: { properties?: Record<string, unknown>; geometry?: unknown }, i: number) =>
    simples(f.geometry as never, String(f.properties?.nombre ?? f.properties?.name ?? `Lugar ${i + 1}`), avisos))
}

/** Valida y recorta: entre 1 y 100 figuras simples válidas. */
function validar(brutos: Bruto[]): ImportedPlace[] {
  if (!brutos.length) throw Error("El archivo no tiene lugares para importar")
  if (brutos.length > MAX_LUGARES) throw Error(`Importá hasta ${MAX_LUGARES} lugares por archivo (este tiene ${brutos.length})`)
  return brutos.map((f, i) => {
    const parsed = geometrySchema.safeParse(f.geometry)
    if (!parsed.success) throw Error(`«${f.nombre || `Lugar ${i + 1}`}»: ${parsed.error.issues[0].message}`)
    return { nombre: f.nombre.slice(0, 120), geometry: parsed.data }
  })
}

/** Texto ya leído (KML o GeoJSON). Usado también por los tests. */
export function parseMapImport(texto: string, filename: string): ResultadoImportacion {
  if (texto.length > 5_000_000) throw Error("El archivo es demasiado grande")
  const avisos: string[] = []
  const brutos = filename.toLowerCase().endsWith(".kml") ? desdeKml(texto, avisos) : desdeGeoJson(texto, avisos)
  return { lugares: validar(brutos), avisos }
}

// ------------------------------------------------------------
// KMZ (ZIP) sin dependencias
// ------------------------------------------------------------

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([datos.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Devuelve el contenido del primer .kml de un ZIP (prefiere doc.kml). */
export async function kmlDesdeKmz(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  const dv = new DataView(buffer)
  // Fin del directorio central: firma 0x06054b50, buscando desde el final
  let fin = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) throw Error("KMZ inválido (no es un archivo ZIP)")
  const total = dv.getUint16(fin + 10, true)
  let p = dv.getUint32(fin + 16, true)
  const entradas: { nombre: string; metodo: number; tam: number; offset: number }[] = []
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw Error("KMZ inválido")
    const metodo = dv.getUint16(p + 10, true)
    const tam = dv.getUint32(p + 20, true)
    const largoNombre = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comentario = dv.getUint16(p + 32, true)
    const offset = dv.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + largoNombre))
    entradas.push({ nombre, metodo, tam, offset })
    p += 46 + largoNombre + extra + comentario
  }
  const kmls = entradas.filter((e) => e.nombre.toLowerCase().endsWith(".kml"))
  const e = kmls.find((k) => k.nombre.toLowerCase().endsWith("doc.kml")) ?? kmls[0]
  if (!e) throw Error("El KMZ no contiene un archivo .kml")
  const inicio = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true)
  const datos = bytes.subarray(inicio, inicio + e.tam)
  if (e.metodo === 0) return new TextDecoder().decode(datos)
  if (e.metodo === 8) return new TextDecoder().decode(await inflar(datos))
  throw Error("KMZ con compresión no soportada")
}

/** Lee un archivo elegido por el usuario: .kmz, .kml, .geojson o .json (máx. 5 MB). */
export async function importarArchivoMapa(file: File): Promise<ResultadoImportacion> {
  if (file.size > 5_000_000) throw Error("El archivo debe pesar menos de 5 MB")
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith(".kmz")) return parseMapImport(await kmlDesdeKmz(await file.arrayBuffer()), "doc.kml")
  return parseMapImport(await file.text(), nombre)
}
