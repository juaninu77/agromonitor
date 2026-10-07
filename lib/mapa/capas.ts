// Capas y modos de color del mapa de potreros (sin dependencias de Leaflet).
// - Capas: grupos de tipos de lugar que se pueden mostrar u ocultar.
// - "Colorear por": tipo, ocupación, carga EV/ha, pasto o días de ocupación/descanso,
//   cada uno con su leyenda. Las escalas son de un solo tono (claro → oscuro) y
//   "sin dato" siempre es gris, para no confundir ausencia de dato con valor bajo.

import { SECTOR_TYPES, sectorColor } from "./geometry"
import { formatearEv } from "./carga"
import { isParcel, sectorState } from "./sector-state"
import type { MapSector } from "./types"

export const GRUPOS_CAPA = [
  { id: "parcelas", label: "Potreros y parcelas", tipos: ["potrero", "cultivo"] },
  { id: "instalaciones", label: "Corrales e instalaciones", tipos: ["corral", "manga", "feedlot", "embarcadero", "enfermeria", "galpon", "casa", "otro"] },
  { id: "agua", label: "Aguadas y tranqueras", tipos: ["aguada", "tranquera"] },
  { id: "lineas", label: "Caminos y alambrados", tipos: ["camino", "alambrado"] },
  { id: "limite", label: "Límite del campo", tipos: ["limite"] },
] as const

export type GrupoCapa = (typeof GRUPOS_CAPA)[number]["id"]

export const grupoDeTipo = (tipo: string): GrupoCapa =>
  GRUPOS_CAPA.find((g) => (g.tipos as readonly string[]).includes(tipo))?.id ?? "instalaciones"

export const MODOS_COLOR = [
  { id: "tipo", label: "Tipo de lugar" },
  { id: "ocupacion", label: "Ocupación" },
  { id: "carga", label: "Carga animal (EV/ha)" },
  { id: "pasto", label: "Altura de pasto" },
  { id: "dias", label: "Días de ocupación / descanso" },
] as const

export type ModoColor = (typeof MODOS_COLOR)[number]["id"]

export interface ItemLeyenda {
  color: string
  label: string
}

const SIN_DATO = "#9ca3af"
const NO_APLICA = "#cbd5e1"

interface Escala {
  limites: number[] // límites superiores de cada tramo (el último tramo no tiene límite)
  colores: string[] // limites.length + 1 colores
  etiquetas: string[]
}

// Azules para carga, verdes para pasto, violetas para descanso (Tailwind 200 → 800)
const ESCALA_CARGA: Escala = {
  limites: [0.25, 0.5, 1, 1.5],
  colores: ["#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#1e3a8a"],
  etiquetas: ["Menos de 0,25", "0,25 a 0,5", "0,5 a 1", "1 a 1,5", "Más de 1,5 EV/ha"],
}
const ESCALA_PASTO: Escala = {
  limites: [5, 10, 20, 30],
  colores: ["#d9f99d", "#a3e635", "#65a30d", "#3f6212", "#1a2e05"],
  etiquetas: ["Menos de 5 cm", "5 a 10 cm", "10 a 20 cm", "20 a 30 cm", "Más de 30 cm"],
}
const ESCALA_DESCANSO: Escala = {
  limites: [15, 30, 60],
  colores: ["#ddd6fe", "#a78bfa", "#7c3aed", "#4c1d95"],
  etiquetas: ["Descanso < 15 días", "15 a 30 días", "30 a 60 días", "Más de 60 días"],
}
const COLOR_OCUPADO = "#ea580c"

function enEscala(e: Escala, v: number) {
  const i = e.limites.findIndex((l) => v < l)
  return e.colores[i === -1 ? e.limites.length : i]
}

/** Una medición de más de 30 días no representa el pasto actual. */
export const MEDICION_VIGENTE_DIAS = 30

export function medicionVigente(s: Pick<MapSector, "ultimaMedicion">, ahora = Date.now()): boolean {
  if (!s.ultimaMedicion) return false
  return ahora - new Date(s.ultimaMedicion.fecha).getTime() <= MEDICION_VIGENTE_DIAS * 86_400_000
}

/** Color de un lugar según el modo elegido. */
export function colorDeLugar(s: MapSector, modo: ModoColor, satellite: boolean): string {
  if (modo === "tipo") return s.tipo === "alambrado" ? (satellite ? "#f8fafc" : "#334155") : sectorColor(s.tipo)
  if (modo === "ocupacion") return sectorState(s).color
  // Los demás modos solo tienen sentido para lugares con animales o pasto
  const aplica = isParcel(s.tipo) || ["corral", "feedlot", "manga", "enfermeria", "embarcadero"].includes(s.tipo)
  if (!aplica) return NO_APLICA
  if (modo === "carga") return s.evHa == null ? SIN_DATO : s.animales === 0 ? "#e5e7eb" : enEscala(ESCALA_CARGA, s.evHa)
  if (modo === "pasto") {
    if (!isParcel(s.tipo)) return NO_APLICA
    const h = s.ultimaMedicion?.alturaPastoCm
    return h == null || !medicionVigente(s) ? SIN_DATO : enEscala(ESCALA_PASTO, h)
  }
  // dias
  if (s.animales > 0) return COLOR_OCUPADO
  return s.diasDescanso == null ? SIN_DATO : enEscala(ESCALA_DESCANSO, s.diasDescanso)
}

/** Leyenda del modo; en "tipo" solo los tipos presentes en el mapa. */
export function leyendaDeModo(modo: ModoColor, tiposPresentes: string[] = []): ItemLeyenda[] {
  const items = (e: Escala) => e.colores.map((color, i) => ({ color, label: e.etiquetas[i] }))
  switch (modo) {
    case "tipo":
      return SECTOR_TYPES.filter(([t]) => tiposPresentes.includes(t)).map(([, label, color]) => ({ color, label }))
    case "ocupacion":
      return [
        { color: "#2563eb", label: "Con ganado" },
        { color: "#8b5cf6", label: "En descanso" },
        { color: "#b7791f", label: "Con cultivo" },
        { color: "#64748b", label: "Sin ganado / instalación" },
      ]
    case "carga":
      return [{ color: "#e5e7eb", label: "Sin animales" }, ...items(ESCALA_CARGA), { color: SIN_DATO, label: "Sin superficie" }]
    case "pasto":
      return [...items(ESCALA_PASTO), { color: SIN_DATO, label: `Sin medición de los últimos ${MEDICION_VIGENTE_DIAS} días` }]
    case "dias":
      return [{ color: COLOR_OCUPADO, label: "Ocupado" }, ...items(ESCALA_DESCANSO), { color: SIN_DATO, label: "Sin historial" }]
  }
}

/** Texto corto del indicador del modo, para la etiqueta del lugar. */
export function indicadorDeModo(s: MapSector, modo: ModoColor): string | null {
  switch (modo) {
    case "carga":
      return s.evHa != null && s.animales > 0 ? `${formatearEv(s.evHa)} EV/ha` : null
    case "pasto":
      return s.ultimaMedicion?.alturaPastoCm != null && medicionVigente(s) ? `${s.ultimaMedicion.alturaPastoCm} cm` : null
    case "dias":
      return s.animales > 0 && s.diasOcupacion != null
        ? `${s.diasOcupacion} d ocupado`
        : s.diasDescanso != null
          ? `${s.diasDescanso} d descanso`
          : null
    default:
      return null
  }
}

// ------------------------------------------------------------
// Resumen del campo y alertas
// ------------------------------------------------------------

export interface Alerta {
  sectorId: string
  nombre: string
  tipo: "sobrecarga" | "pasto" | "agua"
  texto: string
}

export const PASTO_BAJO_CM = 5

export function alertasDelCampo(sectors: MapSector[]): Alerta[] {
  const alertas: Alerta[] = []
  for (const s of sectors) {
    if (s.ocupacionPct != null && s.ocupacionPct > 100) {
      alertas.push({ sectorId: s.id, nombre: s.nombre, tipo: "sobrecarga", texto: `${s.animales} animales para una capacidad de ${s.capacidad} (${s.ocupacionPct}%)` })
    }
    const h = s.ultimaMedicion?.alturaPastoCm
    if (isParcel(s.tipo) && s.animales > 0 && h != null && h < PASTO_BAJO_CM && medicionVigente(s)) {
      alertas.push({ sectorId: s.id, nombre: s.nombre, tipo: "pasto", texto: `Pasto de ${h} cm con ${s.animales} animales` })
    }
    if (s.agua && ["sin_agua", "requiere_revision"].includes(s.agua.estado)) {
      alertas.push({ sectorId: s.id, nombre: s.nombre, tipo: "agua", texto: s.agua.estado === "sin_agua" ? "Sin agua" : "Agua: requiere revisión" })
    }
  }
  const orden = { agua: 0, sobrecarga: 1, pasto: 2 }
  return alertas.sort((a, b) => orden[a.tipo] - orden[b.tipo])
}

export interface ResumenCampo {
  hectareasPorTipo: { tipo: string; mapaHa: number; declaradaHa: number }[]
  porEspecie: Record<string, number>
  animales: number
  ev: number
  /** EV en potreros y parcelas sobre su superficie. */
  cargaGlobal: number | null
  sinUbicar: number
  pendientes: number
  lotesEnPastoreo: number
}

export function resumenDelCampo(sectors: MapSector[]): ResumenCampo {
  const porTipo = new Map<string, { mapaHa: number; declaradaHa: number }>()
  const porEspecie: Record<string, number> = {}
  let animales = 0, ev = 0, evParcelas = 0, haParcelas = 0, sinUbicar = 0, pendientes = 0, lotes = 0
  for (const s of sectors) {
    if (s.areaMapaHa != null || s.superficieHa != null) {
      const t = porTipo.get(s.tipo) ?? { mapaHa: 0, declaradaHa: 0 }
      t.mapaHa += s.areaMapaHa ?? 0
      t.declaradaHa += s.superficieHa ?? 0
      porTipo.set(s.tipo, t)
    }
    for (const [especie, n] of Object.entries(s.porEspecie ?? {})) porEspecie[especie] = (porEspecie[especie] ?? 0) + n
    animales += s.animales
    ev += s.ev
    if (isParcel(s.tipo)) {
      evParcelas += s.ev
      haParcelas += s.superficieHa ?? s.areaMapaHa ?? 0
    }
    if (!s.geometria) sinUbicar++
    pendientes += s.pendientes
    lotes += s.pastoreosIngreso.length
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    hectareasPorTipo: [...porTipo].map(([tipo, v]) => ({ tipo, mapaHa: r2(v.mapaHa), declaradaHa: r2(v.declaradaHa) })).sort((a, b) => b.mapaHa - a.mapaHa),
    porEspecie,
    animales,
    ev: r2(ev),
    cargaGlobal: haParcelas > 0 ? r2(evParcelas / haParcelas) : null,
    sinUbicar,
    pendientes,
    lotesEnPastoreo: lotes,
  }
}
