// Proyección de un protocolo a fechas concretas del año (spec 02 §2.7). Función pura:
// la usan la vista previa y la creación del calendario. Client-safe.

import type { ItemPlan, Momento, ZonaAftosa } from "./plan"

export interface Anclas {
  fechaInicio: string
  fechaCampaniaOtono?: string | null
  fechaCampaniaPrimavera?: string | null
  fechaPreServicio?: string | null
  fechaDestete?: string | null
  fechaPreEsquila?: string | null
}

export const ANCLA_POR_MOMENTO: Record<Exclude<Momento, "fecha">, keyof Anclas> = {
  inicio: "fechaInicio",
  campania_otono: "fechaCampaniaOtono",
  campania_primavera: "fechaCampaniaPrimavera",
  pre_servicio: "fechaPreServicio",
  destete: "fechaDestete",
  pre_esquila: "fechaPreEsquila",
}

export interface Programada { itemId: string | undefined; nombre: string; fecha: string; obligatorio: boolean; repeticion: number }
export interface Omitido { itemId: string | undefined; nombre: string; motivo: string }

const DIA = 86_400_000
const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10)
const esFechaValida = (a: number, m: number, d: number) => { const f = new Date(Date.UTC(a, m - 1, d)); return f.getUTCMonth() === m - 1 && f.getUTCDate() === d }

/** Fechas ancla que usa un conjunto de ítems (para pedir solo esas en el formulario). */
export function anclasNecesarias(items: Pick<ItemPlan, "momento">[]) {
  return [...new Set(items.filter((i) => i.momento !== "fecha" && i.momento !== "inicio").map((i) => ANCLA_POR_MOMENTO[i.momento as Exclude<Momento, "fecha">]))]
}

/**
 * Fechas de cada ítem en el año: desde el inicio del calendario hasta el 31/12. Omite (con
 * el motivo) la aftosa en zona libre sin vacunación, los ítems sin su fecha ancla y lo que
 * ya pasó antes del inicio. Un ítem que se repite genera una tarea por repetición.
 */
export function proyectarItems(items: ItemPlan[], anclas: Anclas, opts: { anio: number; zona: ZonaAftosa | null }) {
  const programadas: Programada[] = []
  const omitidos: Omitido[] = []
  const fin = `${opts.anio}-12-31`
  for (const i of items) {
    if (i.esAftosa && opts.zona === "libre_sin_vacunacion") { omitidos.push({ itemId: i.id, nombre: i.nombre, motivo: "Aftosa: el campo es zona libre sin vacunación" }); continue }
    let base: string | null
    if (i.momento === "fecha") {
      base = i.mes && i.dia && esFechaValida(opts.anio, i.mes, i.dia) ? `${opts.anio}-${String(i.mes).padStart(2, "0")}-${String(i.dia).padStart(2, "0")}` : null
      if (!base) { omitidos.push({ itemId: i.id, nombre: i.nombre, motivo: "La fecha fija no existe en el año" }); continue }
    } else {
      base = anclas[ANCLA_POR_MOMENTO[i.momento]] ?? null
      if (!base) { omitidos.push({ itemId: i.id, nombre: i.nombre, motivo: `Falta la fecha de «${ETIQUETA_ANCLA[ANCLA_POR_MOMENTO[i.momento]]}»` }); continue }
    }
    let fecha = sumarDias(base, i.diasOffset ?? 0)
    let repeticion = 0
    let alguna = false
    // Sin repetición: una sola fecha. Con repetición: cada N días hasta fin de año.
    while (fecha <= fin) {
      if (fecha >= anclas.fechaInicio) { programadas.push({ itemId: i.id, nombre: i.nombre, fecha, obligatorio: i.obligatorio, repeticion }); alguna = true }
      if (!i.repetirCadaDias) break
      fecha = sumarDias(fecha, i.repetirCadaDias)
      repeticion++
    }
    if (!alguna) omitidos.push({ itemId: i.id, nombre: i.nombre, motivo: fecha > fin ? "Cae fuera del año" : "Ya pasó (anterior al inicio del calendario)" })
  }
  programadas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre))
  return { programadas, omitidos }
}

export const ETIQUETA_ANCLA: Record<keyof Anclas, string> = {
  fechaInicio: "Inicio del calendario",
  fechaCampaniaOtono: "Campaña de otoño",
  fechaCampaniaPrimavera: "Campaña de primavera",
  fechaPreServicio: "Inicio del servicio",
  fechaDestete: "Destete",
  fechaPreEsquila: "Esquila",
}
