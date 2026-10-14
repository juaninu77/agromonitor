import { area } from "@turf/area"
import { geometrySchema, SECTOR_TYPES, sectorLabel, type Geometry, type Position } from "./geometry"
import { descendientes, hijo, parsearXml, textoDe, XmlInvalido, type NodoXml } from "./xml"

// Importación de lugares desde Google Earth (KML/KMZ) o GeoJSON (apto para el cliente).
// - KMZ: es un ZIP con un .kml adentro; se abre con DecompressionStream (sin dependencias).
// - Cada figura es un lugar: MultiGeometry / Multi* se separan en partes numeradas.
// - Se reparan los defectos comunes de los archivos de Google Earth: contornos sin cerrar,
//   vértices repetidos seguidos y trazos con más de 500 vértices (se simplifican).
// - Polígonos con huecos: se importa el contorno exterior y se avisa.
// - El tipo de lugar se deduce del dato «tipo» del archivo, del nombre o de la carpeta
//   (por ejemplo «Aguada norte» o la carpeta «Corrales»); si no, de la forma.
// - Una figura que no se puede reparar se omite con el motivo; el resto se importa.

export interface ImportedPlace {
  nombre: string
  tipo: string
  descripcion: string | null
  /** Carpeta del KML donde estaba (para mostrarla en la revisión) */
  carpeta: string | null
  geometry: Geometry
  /** El tipo salió del archivo o del nombre/carpeta (no solo de la forma) */
  tipoDetectado: boolean
}
export interface Omitido { nombre: string; motivo: string }
export interface ResultadoImportacion { lugares: ImportedPlace[]; omitidos: Omitido[]; avisos: string[] }

export const MAX_LUGARES = 100
const MAX_VERTICES = 500
type Par = [number, number]
interface Bruto { nombre: string; geometry: unknown; descripcion?: string | null; carpeta?: string | null; tipo?: string | null }

// ------------------------------------------------------------
// Tipo de lugar
// ------------------------------------------------------------

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Palabras que identifican cada tipo (en el nombre o la carpeta). */
const PALABRAS: [string, RegExp][] = [
  ["limite", /\b(limites?|perimetro|contorno|linderos?)\b/],
  ["aguada", /\b(aguadas?|tanques?|bebederos?|molinos?|represas?|pozos?|perforacion(es)?|australianos?|lagunas?|vertientes?|cisternas?)\b/],
  ["manga", /\b(mangas?|bretes?)\b/],
  ["corral", /\b(corral(es)?|encierres?)\b/],
  ["feedlot", /\b(feed ?lots?)\b/],
  ["embarcadero", /\b(embarcaderos?|cargaderos?)\b/],
  ["enfermeria", /\b(enfermerias?|lazaretos?)\b/],
  ["galpon", /\b(galpon(es)?|depositos?|tinglados?|silos?)\b/],
  ["casa", /\b(casas?|puestos?|viviendas?|cascos?)\b/],
  ["tranquera", /\b(tranqueras?|porton(es)?|guardaganados?)\b/],
  ["camino", /\b(caminos?|rutas?|huellas?|picadas?|accesos?)\b/],
  ["alambrado", /\b(alambrados?|alambres?|divisio(n|nes)|cercos?|boyeros?)\b/],
  ["cultivo", /\b(cultivos?|agricolas?|siembras?|maiz|soja|trigo|girasol|sorgo|cebada)\b/],
  ["potrero", /\b(potreros?|cuadros?|piquetes?|parcelas?|lotes?|pasturas?|mallin(es)?)\b/],
]

/** Formas válidas para cada tipo (un potrero no es un punto ni un camino un área). */
const SOLO_AREA = new Set(["potrero", "cultivo", "limite", "feedlot"])
const SOLO_LINEA = new Set(["camino", "alambrado"])
export function tipoCompatible(tipo: string, forma: Geometry["type"]): boolean {
  if (forma === "Point") return !SOLO_AREA.has(tipo) && !SOLO_LINEA.has(tipo)
  if (forma === "LineString") return SOLO_LINEA.has(tipo) || tipo === "otro"
  return !SOLO_LINEA.has(tipo) && tipo !== "tranquera"
}

/** Tipo por defecto según la forma. */
export const tipoPorForma = (forma: Geometry["type"]) => (forma === "Polygon" ? "potrero" : forma === "LineString" ? "alambrado" : "otro")

/** Tipo nombrado en el texto: la palabra que aparece primero («Potrero del molino» es un potrero). */
export function tipoDesdeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null
  const t = sinAcentos(texto)
  let mejor: { tipo: string; pos: number } | null = null
  for (const [tipo, re] of PALABRAS) {
    const m = re.exec(t)
    if (m && (!mejor || m.index < mejor.pos)) mejor = { tipo, pos: m.index }
  }
  return mejor?.tipo ?? null
}

/** Un «tipo» escrito en el archivo: la clave («aguada») o el nombre que muestra la app («Aguada / tanque»). */
function tipoExplicito(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = sinAcentos(valor.trim())
  const t = SECTOR_TYPES.find(([clave, label]) => clave === v || sinAcentos(label) === v)
  return t?.[0] ?? tipoDesdeTexto(valor)
}

/** Tipo de un lugar importado: el del archivo, el del nombre, el de la carpeta o el de la forma. */
export function inferirTipo(b: { nombre: string; carpeta?: string | null; tipo?: string | null }, forma: Geometry["type"]): { tipo: string; detectado: boolean } {
  for (const candidato of [tipoExplicito(b.tipo), tipoDesdeTexto(b.nombre), tipoDesdeTexto(b.carpeta)]) {
    if (candidato && tipoCompatible(candidato, forma)) return { tipo: candidato, detectado: true }
  }
  return { tipo: tipoPorForma(forma), detectado: false }
}

// ------------------------------------------------------------
// Reparación de geometrías
// ------------------------------------------------------------

const igual = (a: Par, b: Par) => a[0] === b[0] && a[1] === b[1]
const sinRepetidosSeguidos = (pts: Par[]) => pts.filter((p, i) => i === 0 || !igual(p, pts[i - 1]))

/** Douglas-Peucker en metros (proyección plana local). */
function simplificar(pts: Par[], tolM: number): Par[] {
  if (pts.length <= 2) return pts
  const lat0 = (pts.reduce((s, p) => s + p[1], 0) / pts.length) * (Math.PI / 180)
  const xy = pts.map((p) => [p[0] * 111_320 * Math.cos(lat0), p[1] * 110_540] as const)
  const conservar = new Uint8Array(pts.length); conservar[0] = 1; conservar[pts.length - 1] = 1
  const pila: [number, number][] = [[0, pts.length - 1]]
  while (pila.length) {
    const [a, b] = pila.pop()!
    let maxD = 0, idx = -1
    const [ax, ay] = xy[a], [bx, by] = xy[b], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (d > maxD) { maxD = d; idx = i }
    }
    if (idx > 0 && maxD > tolM) { conservar[idx] = 1; pila.push([a, idx], [idx, b]) }
  }
  return pts.filter((_, i) => conservar[i])
}

/** Reduce a `max` vértices subiendo la tolerancia (desde medio metro). */
function limitarVertices(pts: Par[], max: number): Par[] {
  let tol = 0.5, out = pts
  while (out.length > max && tol < 100_000) { out = simplificar(pts, tol); tol *= 2 }
  return out
}

/** Repara una figura simple; devuelve la geometría y un aviso si se simplificó. */
function reparar(g: { type?: string; coordinates?: unknown }, nombre: string, avisos: string[]): unknown {
  const pares = (c: unknown): Par[] | null =>
    Array.isArray(c) && c.every((p) => Array.isArray(p) && p.length >= 2) ? (c as number[][]).map((p) => [Number(p[0]), Number(p[1])] as Par) : null
  if (g.type === "LineString") {
    const pts = pares(g.coordinates)
    if (!pts) return g
    const limpios = sinRepetidosSeguidos(pts)
    const final = limitarVertices(limpios, MAX_VERTICES)
    if (final.length < limpios.length) avisos.push(`«${nombre}»: se simplificó de ${limpios.length} a ${final.length} vértices`)
    return { type: "LineString", coordinates: final }
  }
  if (g.type === "Polygon") {
    const anillos = Array.isArray(g.coordinates) ? g.coordinates : []
    const pts = pares(anillos[0])
    if (!pts) return g
    let anillo = sinRepetidosSeguidos(pts)
    if (anillo.length > 1 && igual(anillo[0], anillo[anillo.length - 1])) anillo = anillo.slice(0, -1)
    const final = limitarVertices([...anillo, anillo[0]], MAX_VERTICES + 1)
    if (final.length < anillo.length + 1) avisos.push(`«${nombre}»: se simplificó de ${anillo.length} a ${final.length - 1} vértices`)
    return { type: "Polygon", coordinates: [final] }
  }
  if (g.type === "Point") {
    const p = Array.isArray(g.coordinates) ? g.coordinates : []
    return { type: "Point", coordinates: [Number(p[0]), Number(p[1])] }
  }
  return g
}

/** Separa una geometría GeoJSON en figuras simples (Point, LineString o Polygon de un anillo). */
function simples(g: { type?: string; coordinates?: unknown; geometries?: unknown[] } | null | undefined, base: Omit<Bruto, "geometry">, avisos: string[]): Bruto[] {
  const { nombre } = base
  if (!g || typeof g !== "object") return [{ ...base, geometry: g }]
  switch (g.type) {
    case "Polygon": {
      const anillos = Array.isArray(g.coordinates) ? g.coordinates : []
      if (anillos.length > 1) avisos.push(`«${nombre}»: se ignoraron ${anillos.length - 1} ${anillos.length - 1 === 1 ? "hueco" : "huecos"} (se importó el contorno exterior)`)
      return [{ ...base, geometry: { type: "Polygon", coordinates: anillos.slice(0, 1) } }]
    }
    case "MultiPolygon":
    case "MultiLineString":
    case "MultiPoint": {
      const tipo = g.type.replace("Multi", "")
      const partes = Array.isArray(g.coordinates) ? g.coordinates : []
      return partes.flatMap((c, i) => simples({ type: tipo, coordinates: c }, { ...base, nombre: partes.length > 1 ? `${nombre} (${i + 1})` : nombre }, avisos))
    }
    case "GeometryCollection": {
      const partes = Array.isArray(g.geometries) ? g.geometries : []
      return partes.flatMap((p, i) => simples(p as typeof g, { ...base, nombre: partes.length > 1 ? `${nombre} (${i + 1})` : nombre }, avisos))
    }
    default:
      return [{ ...base, geometry: g }]
  }
}

// ------------------------------------------------------------
// KML
// ------------------------------------------------------------

const parsePares = (texto: string): Par[] =>
  texto.trim().split(/\s+/).filter(Boolean).map((v) => v.split(",").slice(0, 2).map(Number) as Par)

/** Texto plano de una descripción (Google Earth suele guardar HTML). */
function textoPlano(html: string): string | null {
  const t = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim()
  return t ? t.slice(0, 3000) : null
}

/** Dato «tipo» de ExtendedData (Data o SchemaData/SimpleData). */
function tipoExtendido(p: NodoXml): string | null {
  const ext = hijo(p, "ExtendedData")
  if (!ext) return null
  for (const d of descendientes(ext, "Data")) if (/^tipo$/i.test(d.atributos.name ?? "")) return textoDe(hijo(d, "value")).trim() || null
  for (const d of descendientes(ext, "SimpleData")) if (/^tipo$/i.test(d.atributos.name ?? "")) return textoDe(d).trim() || null
  return null
}

/** Geometrías de un Placemark, en GeoJSON. */
function geometriasKml(n: NodoXml, avisos: string[], nombre: string): unknown[] {
  const coords = (x: NodoXml | undefined) => parsePares(textoDe(hijo(x, "coordinates")))
  const out: unknown[] = []
  for (const h of n.hijos) {
    switch (h.nombre) {
      case "Point": out.push({ type: "Point", coordinates: coords(h)[0] }); break
      case "LineString": out.push({ type: "LineString", coordinates: coords(h) }); break
      case "LinearRing": out.push({ type: "Polygon", coordinates: [coords(h)] }); break
      case "Polygon": {
        const exterior = coords(hijo(hijo(h, "outerBoundaryIs"), "LinearRing"))
        const huecos = h.hijos.filter((x) => x.nombre === "innerBoundaryIs").map((ib) => coords(hijo(ib, "LinearRing")))
        out.push({ type: "Polygon", coordinates: [exterior, ...huecos] })
        break
      }
      case "MultiGeometry": out.push(...geometriasKml(h, avisos, nombre)); break
      case "Track": case "MultiTrack": case "Model":
        avisos.push(`«${nombre}»: se ignoró un ${h.nombre === "Model" ? "modelo 3D" : "recorrido GPS"}`)
        break
    }
  }
  return out
}

function desdeKml(texto: string, avisos: string[]): Bruto[] {
  let raiz: NodoXml
  try { raiz = parsearXml(texto) } catch (e) { throw Error(e instanceof XmlInvalido ? e.message : "KML inválido") }
  const brutos: Bruto[] = []
  let n = 0
  const recorrer = (nodo: NodoXml, carpeta: string | null) => {
    for (const h of nodo.hijos) {
      if (h.nombre === "Folder" || h.nombre === "Document") {
        const nombreCarpeta = textoDe(hijo(h, "name")).trim()
        recorrer(h, h.nombre === "Folder" && nombreCarpeta ? nombreCarpeta : carpeta)
      } else if (h.nombre === "Placemark") {
        n++
        const nombre = textoDe(hijo(h, "name")).trim() || `Lugar ${n}`
        const figuras = geometriasKml(h, avisos, nombre)
        const base = { descripcion: textoPlano(textoDe(hijo(h, "description"))), carpeta, tipo: tipoExtendido(h) }
        figuras.forEach((g, j) => brutos.push(...simples(g as never, { ...base, nombre: figuras.length > 1 ? `${nombre} (${j + 1})` : nombre }, avisos)))
      }
    }
  }
  recorrer(raiz, null)
  return brutos
}

// ------------------------------------------------------------
// GeoJSON
// ------------------------------------------------------------

function desdeGeoJson(texto: string, avisos: string[]): Bruto[] {
  const raw = JSON.parse(texto)
  const lista = raw.type === "FeatureCollection" ? raw.features : raw.type === "Feature" ? [raw] : [{ geometry: raw }]
  if (!Array.isArray(lista)) throw Error("GeoJSON inválido")
  return lista.flatMap((f: { properties?: Record<string, unknown> | null; geometry?: unknown }, i: number) => {
    const p = f.properties ?? {}
    const desc = p.descripcion ?? p.description
    return simples(f.geometry as never, {
      nombre: String(p.nombre ?? p.name ?? `Lugar ${i + 1}`),
      descripcion: typeof desc === "string" ? textoPlano(desc) : null,
      carpeta: typeof p.carpeta === "string" ? p.carpeta : null,
      tipo: typeof p.tipo === "string" ? p.tipo : null,
    }, avisos)
  })
}

// ------------------------------------------------------------
// Validación, tipos y límite del campo
// ------------------------------------------------------------

type Caja = [number, number, number, number]
const caja = (anillo: Position[]): Caja => [
  Math.min(...anillo.map((p) => p[0])), Math.min(...anillo.map((p) => p[1])),
  Math.max(...anillo.map((p) => p[0])), Math.max(...anillo.map((p) => p[1])),
]
const contiene = (a: Caja, b: Caja) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3]

/**
 * Un polígono sin tipo reconocido que encierra a otros dos o más es el límite del campo
 * (Google Earth suele exportar el perímetro junto con los potreros).
 */
function detectarLimite(lugares: ImportedPlace[], avisos: string[]) {
  if (lugares.some((l) => l.tipo === "limite")) return
  const poligonos = lugares.filter((l) => l.geometry.type === "Polygon")
  if (poligonos.length < 3) return
  const conArea = poligonos.map((l) => ({ l, a: area(l.geometry as never), c: caja((l.geometry as Extract<Geometry, { type: "Polygon" }>).coordinates[0]) }))
  conArea.sort((x, y) => y.a - x.a)
  const mayor = conArea[0]
  if (mayor.l.tipoDetectado) return
  if (conArea.slice(1).filter((o) => contiene(mayor.c, o.c)).length >= 2) {
    mayor.l.tipo = "limite"
    mayor.l.tipoDetectado = true
    avisos.push(`«${mayor.l.nombre}» se tomó como ${sectorLabel("limite").toLowerCase()} porque encierra a los demás (podés cambiarlo)`)
  }
}

function validar(brutos: Bruto[], avisos: string[]): { lugares: ImportedPlace[]; omitidos: Omitido[] } {
  if (!brutos.length) throw Error("El archivo no tiene lugares para importar")
  const lugares: ImportedPlace[] = [], omitidos: Omitido[] = []
  brutos.forEach((b, i) => {
    const nombre = (b.nombre || `Lugar ${i + 1}`).trim().slice(0, 120) || `Lugar ${i + 1}`
    const reparada = b.geometry && typeof b.geometry === "object" ? reparar(b.geometry as never, nombre, avisos) : b.geometry
    const parsed = geometrySchema.safeParse(reparada)
    if (!parsed.success) { omitidos.push({ nombre, motivo: parsed.error.issues[0]?.message ?? "Figura inválida" }); return }
    const { tipo, detectado } = inferirTipo({ ...b, nombre }, parsed.data.type)
    lugares.push({ nombre, tipo, descripcion: b.descripcion ?? null, carpeta: b.carpeta ?? null, geometry: parsed.data, tipoDetectado: detectado })
  })
  if (!lugares.length) {
    throw Error(omitidos.length === 1 ? `«${omitidos[0].nombre}»: ${omitidos[0].motivo}` : `Ninguna figura del archivo es válida (${omitidos[0]?.motivo ?? "sin figuras"})`)
  }
  if (lugares.length > MAX_LUGARES) throw Error(`Importá hasta ${MAX_LUGARES} lugares por archivo (este tiene ${lugares.length}): separalo en carpetas o archivos más chicos`)
  detectarLimite(lugares, avisos)
  return { lugares, omitidos }
}

/** Texto ya leído (KML o GeoJSON). Usado también por los tests. */
export function parseMapImport(texto: string, filename: string): ResultadoImportacion {
  if (texto.length > 5_000_000) throw Error("El archivo es demasiado grande")
  const avisos: string[] = []
  const brutos = filename.toLowerCase().endsWith(".kml") ? desdeKml(texto, avisos) : desdeGeoJson(texto, avisos)
  const { lugares, omitidos } = validar(brutos, avisos)
  return { lugares, omitidos, avisos }
}

const normalizar = (s: string) => s.trim().toLowerCase()

/** Nombres libres: si ya existe (en el campo o antes en la lista) agrega « (2)», « (3)»… */
export function nombresLibres(pedidos: string[], existentes: string[]): string[] {
  const usados = new Set(existentes.map(normalizar))
  return pedidos.map((pedido) => {
    let nombre = pedido.slice(0, 120), n = 2
    while (usados.has(normalizar(nombre))) {
      const sufijo = ` (${n++})`
      nombre = `${pedido.slice(0, 120 - sufijo.length)}${sufijo}`
    }
    usados.add(normalizar(nombre))
    return nombre
  })
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
