// Herramientas de dibujo del mapa (sin dependencias de Leaflet, testeables):
// forma por defecto de cada tipo de lugar, rectángulos rotados, medidas en
// metros y división de un potrero con una línea (alambrado).
//
// Las cuentas geométricas usan una proyección plana local (equirectangular
// centrada en el dibujo): el error es despreciable para potreros y corrales.

import type { Position } from "./geometry"

export type Forma = "Polygon" | "Rectangle" | "LineString" | "Point"

/** Forma con la que se empieza a dibujar cada tipo; el usuario puede cambiarla. */
export const FORMA_POR_TIPO: Record<string, Forma> = {
  potrero: "Polygon",
  cultivo: "Polygon",
  limite: "Polygon",
  corral: "Rectangle",
  manga: "Rectangle",
  feedlot: "Rectangle",
  galpon: "Rectangle",
  embarcadero: "Rectangle",
  enfermeria: "Rectangle",
  casa: "Rectangle",
  camino: "LineString",
  alambrado: "LineString",
  aguada: "Point",
  tranquera: "Point",
  otro: "Polygon",
}

export const formaPorTipo = (tipo: string): Forma => FORMA_POR_TIPO[tipo] ?? "Polygon"

/** Tipo de geometría que se guarda para cada forma (el rectángulo es un polígono). */
export const geometriaDeForma = (forma: Forma): "Polygon" | "LineString" | "Point" => (forma === "Rectangle" ? "Polygon" : forma)

const RADIO_TIERRA = 6_371_008.8
const rad = (g: number) => (g * Math.PI) / 180

/** Distancia geodésica (haversine) en metros. */
export function distanciaM(a: Position, b: Position): number {
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Largo de una línea abierta en metros. */
export function largoM(vertices: Position[]): number {
  let total = 0
  for (let i = 1; i < vertices.length; i++) total += distanciaM(vertices[i - 1], vertices[i])
  return total
}

/** Perímetro de un contorno (sin repetir el primer vértice al final) en metros. */
export function perimetroM(vertices: Position[]): number {
  return vertices.length < 3 ? largoM(vertices) : largoM([...vertices, vertices[0]])
}

/** "850 m" o "1,25 km". */
export function formatearDistancia(m: number): string {
  return m < 1000
    ? `${Math.round(m).toLocaleString("es-AR")} m`
    : `${(m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} km`
}

// ------------------------------------------------------------
// Proyección plana local (metros) alrededor de un origen
// ------------------------------------------------------------

interface Plano {
  a: (p: Position) => [number, number]
  de: (xy: [number, number]) => Position
}

function plano(origen: Position): Plano {
  const kx = 111_320 * Math.cos(rad(origen[1]))
  const ky = 110_540
  return {
    a: (p) => [(p[0] - origen[0]) * kx, (p[1] - origen[1]) * ky],
    de: ([x, y]) => [origen[0] + x / kx, origen[1] + y / ky],
  }
}

/**
 * Rectángulo a partir de tres clics: los dos primeros marcan un lado (con
 * cualquier orientación) y el tercero el ancho, medido en perpendicular.
 * Devuelve los 4 vértices o null si el lado o el ancho son nulos.
 */
export function rectanguloDesde3Puntos(a: Position, b: Position, c: Position): Position[] | null {
  const pl = plano(a)
  const [bx, by] = pl.a(b)
  const [cx, cy] = pl.a(c)
  const largo = Math.hypot(bx, by)
  if (largo < 0.01) return null
  // Normal unitaria al lado AB y distancia con signo de C a esa recta
  const nx = -by / largo
  const ny = bx / largo
  const ancho = cx * nx + cy * ny
  if (Math.abs(ancho) < 0.01) return null
  const ox = nx * ancho
  const oy = ny * ancho
  return [a, b, pl.de([bx + ox, by + oy]), pl.de([ox, oy])]
}

// ------------------------------------------------------------
// Imán: acercar un punto a vértices o bordes existentes
// ------------------------------------------------------------

/** Punto más cercano a P sobre el segmento AB (en coordenadas planas cualesquiera). */
export function proyectarEnSegmento(p: [number, number], a: [number, number], b: [number, number]): { punto: [number, number]; t: number } {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
  return { punto: [a[0] + t * dx, a[1] + t * dy], t }
}

// ------------------------------------------------------------
// División de un polígono con una línea
// ------------------------------------------------------------

export class DivisionError extends Error {}

interface Cruce {
  /** Posición a lo largo del contorno: índice del lado + fracción (0..1). */
  posAnillo: number
  /** Posición a lo largo de la línea: índice del tramo + fracción. */
  posLinea: number
  xy: [number, number]
}

const EPS = 1e-9

function interseccion(p: [number, number], p2: [number, number], q: [number, number], q2: [number, number]) {
  const r = [p2[0] - p[0], p2[1] - p[1]]
  const s = [q2[0] - q[0], q2[1] - q[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < EPS) return null // paralelos
  const qp = [q[0] - p[0], q[1] - p[1]]
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den
  const u = (qp[0] * r[1] - qp[1] * r[0]) / den
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null
  return { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)) }
}

function dentro(p: [number, number], anillo: [number, number][]): boolean {
  let adentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

function sinRepetidos(puntos: [number, number][]): [number, number][] {
  const res: [number, number][] = []
  for (const p of puntos) {
    const prev = res[res.length - 1]
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.001) res.push(p)
  }
  const first = res[0]
  const last = res[res.length - 1]
  if (res.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.001) res.pop()
  return res
}

/**
 * Corta un contorno (vértices sin cerrar) con una línea que lo atraviesa de
 * borde a borde. Usa los dos primeros cruces de la línea con el contorno.
 * Devuelve las dos partes (vértices sin cerrar) y el tramo de corte que
 * queda dentro del contorno (el alambrado).
 */
export function dividirPoligono(contorno: Position[], linea: Position[]): { partes: [Position[], Position[]]; corte: Position[] } {
  if (contorno.length < 3) throw new DivisionError("El sector no tiene un contorno válido")
  if (linea.length < 2) throw new DivisionError("Dibujá la división con al menos dos puntos")

  const pl = plano(contorno[0])
  const anillo = contorno.map(pl.a)
  const traza = linea.map(pl.a)
  const n = anillo.length

  const cruces: Cruce[] = []
  for (let j = 0; j < traza.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const hit = interseccion(traza[j], traza[j + 1], anillo[i], anillo[(i + 1) % n])
      if (!hit) continue
      const xy: [number, number] = [traza[j][0] + hit.t * (traza[j + 1][0] - traza[j][0]), traza[j][1] + hit.t * (traza[j + 1][1] - traza[j][1])]
      const posLinea = j + hit.t
      // Un cruce justo en un vértice aparece en dos lados: se cuenta una vez
      if (cruces.some((c) => Math.abs(c.posLinea - posLinea) < 1e-7)) continue
      cruces.push({ posAnillo: (i + hit.u) % n, posLinea, xy })
    }
  }
  cruces.sort((a, b) => a.posLinea - b.posLinea)
  if (cruces.length < 2) {
    throw new DivisionError("La línea tiene que cruzar el contorno de lado a lado: empezá y terminá fuera del sector")
  }
  const [x1, x2] = cruces

  // Tramo de la línea entre los dos cruces (debe quedar dentro del contorno)
  const interiores: [number, number][] = []
  for (let k = Math.floor(x1.posLinea) + 1; k <= x2.posLinea - EPS && k < traza.length; k++) interiores.push(traza[k])
  const corteXY: [number, number][] = [x1.xy, ...interiores, x2.xy]
  const medio: [number, number] = [(corteXY[0][0] + corteXY[1][0]) / 2, (corteXY[0][1] + corteXY[1][1]) / 2]
  if (!dentro(medio, anillo)) throw new DivisionError("La línea tiene que pasar por adentro del sector")

  // Vértices del contorno recorridos hacia adelante desde la posición p hasta q
  const recorrer = (p: number, q: number): [number, number][] => {
    const fin = q > p ? q : q + n
    const res: [number, number][] = []
    for (let k = Math.floor(p) + 1; k < fin - EPS; k++) if (k > p + EPS) res.push(anillo[k % n])
    return res
  }

  const parteA = sinRepetidos([x1.xy, ...recorrer(x1.posAnillo, x2.posAnillo), x2.xy, ...interiores.slice().reverse()])
  const parteB = sinRepetidos([x2.xy, ...recorrer(x2.posAnillo, x1.posAnillo), x1.xy, ...interiores])
  if (parteA.length < 3 || parteB.length < 3) throw new DivisionError("La división deja una parte sin superficie")

  return { partes: [parteA.map(pl.de), parteB.map(pl.de)], corte: corteXY.map(pl.de) }
}

// ------------------------------------------------------------
// Superposición entre parcelas
// ------------------------------------------------------------

/** Cruce propio (interior de ambos segmentos), no en extremos ni colineal. */
function crucePropio(p: [number, number], p2: [number, number], q: [number, number], q2: [number, number]): boolean {
  const r = [p2[0] - p[0], p2[1] - p[1]]
  const s = [q2[0] - q[0], q2[1] - q[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return false
  const qp = [q[0] - p[0], q[1] - p[1]]
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den
  const u = (qp[0] * r[1] - qp[1] * r[0]) / den
  const m = 1e-6
  return t > m && t < 1 - m && u > m && u < 1 - m
}

function distanciaABorde(p: [number, number], anillo: [number, number][]): number {
  let min = Infinity
  for (let i = 0; i < anillo.length; i++) {
    const { punto } = proyectarEnSegmento(p, anillo[i], anillo[(i + 1) % anillo.length])
    min = Math.min(min, Math.hypot(punto[0] - p[0], punto[1] - p[1]))
  }
  return min
}

/**
 * Dos contornos se superponen si sus bordes se cruzan o si un vértice de uno
 * queda dentro del otro a más de 1 m del borde. Compartir un lado o una
 * esquina (potreros vecinos dibujados con el imán) no cuenta.
 */
export function seSuperponen(a: Position[], b: Position[]): boolean {
  if (a.length < 3 || b.length < 3) return false
  const pl = plano(a[0])
  const A = a.map(pl.a)
  const B = b.map(pl.a)
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      if (crucePropio(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true
    }
  }
  const adentro = (P: [number, number][], Q: [number, number][]) => P.some((p) => dentro(p, Q) && distanciaABorde(p, Q) > 1)
  return adentro(A, B) || adentro(B, A)
}
