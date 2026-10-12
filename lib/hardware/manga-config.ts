// Configuración de las sesiones de manga (apta para el cliente). Una sola fuente para el
// diálogo «Nueva Sesión de Manga», el espacio de trabajo, el PDF de documentación y la
// validación del alta de EID nuevos, para que no vuelvan a desalinearse.

import { CC_MAX, CC_MIN } from "@/lib/validations/animal-schema"

export const TIPOS_SESION_MANGA = [
  { value: "pesada_rodeo", label: "Pesada de rodeo", descripcion: "Peso y condición corporal, para el control periódico o antes de una venta." },
  { value: "vacunacion", label: "Vacunación / Antiparasitario", descripcion: "Un mismo tratamiento (producto y dosis) para cada animal que pasa." },
  { value: "tacto", label: "Tacto", descripcion: "Diagnóstico de preñez y apartado de preñadas y vacías." },
  { value: "destete", label: "Destete", descripcion: "Peso y condición corporal de los terneros y apartado a su grupo." },
  { value: "señalada", label: "Señalada", descripcion: "Registro de los animales nuevos (corderos o terneros)." },
  { value: "recepcion", label: "Recepción de hacienda", descripcion: "Alta de los animales comprados con su peso de ingreso." },
  { value: "general", label: "Trabajo general", descripcion: "Todas las acciones disponibles." },
] as const

export type TipoSesionManga = (typeof TIPOS_SESION_MANGA)[number]["value"]

/** Etiqueta corta del tipo (barra de la sesión e historial). */
export const ETIQUETA_TIPO_SESION: Record<string, string> = {
  pesada_rodeo: "Pesada de rodeo",
  vacunacion: "Vacunación",
  tacto: "Tacto",
  destete: "Destete",
  señalada: "Señalada",
  recepcion: "Recepción",
  general: "Trabajo general",
}

export const ACCIONES_MANGA = [
  { id: "peso", label: "Peso" },
  { id: "sanidad", label: "Sanidad" },
  { id: "tacto", label: "Tacto" },
  { id: "cc", label: "Cond. Corporal" },
  { id: "denticion", label: "Dentición" },
  { id: "apartado", label: "Apartado" },
  { id: "registro", label: "Registro nuevo" },
] as const

export type AccionManga = (typeof ACCIONES_MANGA)[number]["id"]

/** Acciones que se marcan solas al elegir el tipo de trabajo (el PDF las lee de acá). */
export const PRESELECCION_POR_TIPO: Record<TipoSesionManga, AccionManga[]> = {
  pesada_rodeo: ["peso", "cc"],
  vacunacion: ["sanidad"],
  tacto: ["tacto", "apartado"],
  destete: ["peso", "cc", "apartado"],
  señalada: ["registro"],
  recepcion: ["peso", "cc", "registro"],
  general: ["peso", "sanidad", "tacto", "cc", "denticion", "apartado", "registro"],
}

/** Preselección del tipo; sin permiso de sanidad no se marca (la sesión no podría definir el producto). */
export function accionesIniciales(tipo: string, puedeSanidad: boolean): AccionManga[] {
  const acciones = PRESELECCION_POR_TIPO[tipo as TipoSesionManga] ?? []
  return acciones.filter((a) => a !== "sanidad" || puedeSanidad)
}

/** Nombres de las acciones, para textos («peso, cond. corporal»). */
export function etiquetasAcciones(acciones: readonly string[]): string {
  return acciones.map((a) => ACCIONES_MANGA.find((x) => x.id === a)?.label.toLowerCase() ?? a).join(", ")
}

/** Condición corporal: la misma escala que Ganado (1 a 9). */
export const ESCALA_CC = Array.from({ length: CC_MAX - CC_MIN + 1 }, (_, i) => String(CC_MIN + i))

/** Unidades de la dosis del tratamiento (las mismas que la aplicación masiva de Sanidad). */
export const UNIDADES_DOSIS = ["ml", "cc", "comprimido"] as const
export type UnidadDosis = (typeof UNIDADES_DOSIS)[number]
export const ETIQUETA_UNIDAD_DOSIS: Record<UnidadDosis, string> = { ml: "ml", cc: "cc", comprimido: "comprimidos" }

/** Unidad de la dosis sugerida según cómo se cuenta el producto en Inventario. */
export function unidadDosisPorDefecto(unidadProducto: string | null | undefined): UnidadDosis {
  const u = (unidadProducto ?? "").trim().toLowerCase()
  if (u === "cc") return "cc"
  if (u === "comprimido" || u === "comprimidos") return "comprimido"
  return "ml"
}

/** Texto del tratamiento de la sesión: «Ivermectina 1% · 5 ml · subcutánea». */
export function textoTratamiento(t: { producto?: string | null; dosis?: number | null; unidad?: string | null; via?: string | null }, etiquetaVia?: (via: string) => string): string {
  const partes = [t.producto ?? "Producto de la sesión"]
  if (t.dosis) partes.push(`${t.dosis.toLocaleString("es-AR")} ${ETIQUETA_UNIDAD_DOSIS[t.unidad as UnidadDosis] ?? t.unidad ?? "ml"}`)
  if (t.via) partes.push(etiquetaVia ? etiquetaVia(t.via) : t.via)
  return partes.join(" · ")
}

/**
 * Especie del alta de un EID nuevo: la elegida, si no la del lote de origen de la sesión,
 * si no la del campo (la de la mayoría de sus animales). Null = que decida el catálogo.
 */
export function especieParaAlta(o: { elegida?: string | null; lote?: string | null; campo?: string | null; disponibles?: string[] }): string | null {
  const valida = (id?: string | null) => !!id && (!o.disponibles || o.disponibles.includes(id))
  if (valida(o.elegida)) return o.elegida!
  if (valida(o.lote)) return o.lote!
  if (valida(o.campo)) return o.campo!
  return null
}

/** Qué falta para dar de alta un EID nuevo, con un mensaje claro (null = está completo). */
export function faltaParaAlta(d: { sexo?: string | null; razaId?: string | null; categoriaId?: string | null }): string | null {
  const faltan = [!d.sexo && "el sexo", !d.razaId && "la raza", !d.categoriaId && "la categoría"].filter(Boolean) as string[]
  if (!faltan.length) return null
  const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(", ")} y ${faltan[faltan.length - 1]}`
  return `Para registrar el animal nuevo elegí ${lista}`
}
