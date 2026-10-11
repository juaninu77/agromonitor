// Esquemas, constantes y etiquetas de Reproducción (compartidos por formularios y API; client-safe).
import { z } from "zod"
import { hoyArgentina } from "@/lib/inventario/fechas"

export const TIPOS_SERVICIO = ["natural", "ia", "iatf"] as const
export const TIPOS_TORADA = ["natural", "ia", "iatf", "mixto"] as const
export const RESULTADOS_TACTO = ["preñada", "vacia", "dudosa", "absorcion"] as const
export const METODOS_TACTO = ["palpacion", "ecografia"] as const
export const RESULTADOS_CRIA = ["vivo", "muerto"] as const
/** Resultado guardado en cada fila de parto: una cría viva o muerta, o un aborto (sin cría). */
export const RESULTADOS_PARTO = ["vivo", "muerto", "aborto"] as const
export const TIPOS_EVENTO = ["servicio", "tacto", "paricion", "destete"] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]
/** Anular un evento: solo admin o encargado del campo (spec 10 §3). */
export const ROLES_ANULAR = ["admin", "encargado"] as const

/** Días de gestación por especie (spec 03 §3.1–3.2). */
export const DIAS_GESTACION: Record<string, number> = { bovino: 283, ovino: 150, caprino: 150, equino: 340, porcino: 114 }
const DIA_MS = 86_400_000
const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)

/**
 * Fecha probable de parto de un tacto positivo (spec 03 §3.7): desde el servicio vinculado
 * (servicio + gestación) o desde los meses de gestación (tacto + gestación − meses·30).
 * También devuelve los meses calculados desde el servicio. Sin datos, null.
 */
export function calcularParto(especie: string | null | undefined, fechaTacto: string, datos: { servicioFecha?: string | null; mesesGest?: number | null }) {
  const dias = DIAS_GESTACION[(especie ?? "").toLowerCase()] ?? DIAS_GESTACION.bovino
  let fecha: string | null = null
  let mesesGest = datos.mesesGest ?? null
  if (datos.servicioFecha) {
    fecha = sumarDias(datos.servicioFecha, dias)
    if (mesesGest == null) mesesGest = Math.round(((Date.parse(fechaTacto) - Date.parse(datos.servicioFecha)) / DIA_MS / 30) * 10) / 10
  } else if (mesesGest != null) {
    fecha = sumarDias(fechaTacto, Math.round(dias - mesesGest * 30))
  }
  if (fecha && fecha <= fechaTacto) fecha = null
  if (mesesGest != null && mesesGest <= 0) mesesGest = null
  return { fecha, mesesGest }
}
export const TIPOS_PARTO = ["normal", "asistido", "cesarea"] as const
export const METODOS_DESTETE = ["tradicional", "precoz", "hiperprecoz", "destetador"] as const

export type ResultadoTacto = (typeof RESULTADOS_TACTO)[number]

/** Quién registra cada cosa en un campo (spec 10 §4). */
export const ROLES_REPRODUCCION = {
  servicio: ["admin", "encargado", "vet", "operario"],
  tacto: ["admin", "encargado", "vet"],
  paricion: ["admin", "encargado", "vet", "operario"],
  destete: ["admin", "encargado", "operario"],
  torada: ["admin", "encargado"],
} as const
export type AccionReproduccion = keyof typeof ROLES_REPRODUCCION

export const ETIQUETA_TIPO_SERVICIO: Record<(typeof TIPOS_TORADA)[number], string> = { natural: "Natural", ia: "IA", iatf: "IATF", mixto: "Mixto" }
export const ETIQUETA_RESULTADO_TACTO: Record<ResultadoTacto, string> = { "preñada": "Preñada", vacia: "Vacía", dudosa: "Dudosa", absorcion: "Absorción" }
/** Letra para la manga (V = vacía). */
export const LETRA_RESULTADO_TACTO: Record<ResultadoTacto, string> = { "preñada": "P", vacia: "V", dudosa: "D", absorcion: "A" }
export const ETIQUETA_METODO_TACTO: Record<(typeof METODOS_TACTO)[number], string> = { palpacion: "Palpación", ecografia: "Ecografía" }
export const ETIQUETA_TIPO_PARTO: Record<(typeof TIPOS_PARTO)[number], string> = { normal: "Normal", asistido: "Asistido", cesarea: "Cesárea" }
export const ETIQUETA_METODO_DESTETE: Record<(typeof METODOS_DESTETE)[number], string> = {
  tradicional: "Tradicional", precoz: "Precoz", hiperprecoz: "Hiperprecoz", destetador: "Destetador",
}

const uuid = z.string().uuid()
const idOpcional = uuid.nullish().or(z.literal("")).transform((v) => v || null)
const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
/** Número de formulario: acepta "5,5"; vacío = sin dato. */
const numero = (base: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v), base.nullable()).optional().transform((v) => v ?? null)
const enumOpcional = <T extends readonly [string, ...string[]]>(valores: T, mensaje: string) =>
  z.enum(valores, { errorMap: () => ({ message: mensaje }) }).nullish().or(z.literal("")).transform((v) => (v || null) as T[number] | null)

/** Día del evento (AAAA-MM-DD). Un instante ISO se toma en hora de Argentina. */
const dia = z.preprocess(
  (v) => (typeof v === "string" && v.length > 10 && !Number.isNaN(Date.parse(v)) ? hoyArgentina(new Date(v)) : v),
  z.string({ required_error: "La fecha es requerida", invalid_type_error: "La fecha es requerida" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Fecha inválida"),
)
const diaOpcional = dia.nullish().or(z.literal("")).transform((v) => v || null)
/** Fecha de un evento ya ocurrido: no futura ni de hace más de 30 años. */
const diaEvento = dia
  .refine((d) => d <= hoyArgentina(), "La fecha no puede ser futura")
  .refine((d) => d >= `${Number(hoyArgentina().slice(0, 4)) - 30}-01-01`, "La fecha es demasiado antigua")

export const servicioSchema = z.object({
  hembraId: z.string({ required_error: "Elegí la hembra" }).uuid("Elegí la hembra"),
  machoId: idOpcional,
  toradaId: idOpcional,
  fecha: diaEvento,
  tipo: z.enum(TIPOS_SERVICIO, { errorMap: () => ({ message: "Tipo de servicio inválido" }) }),
  toroNombre: texto(120),
  loteSemen: texto(60),
  inseminador: texto(120),
  observ: texto(1000),
  /** Confirmación para servir a una hembra que figura preñada. */
  aceptarPrenada: z.boolean().default(false),
})
export type ServicioInput = z.input<typeof servicioSchema>

export const tactoSchema = z.object({
  hembraId: z.string({ required_error: "Elegí la hembra" }).uuid("Elegí la hembra"),
  servicioId: idOpcional,
  fecha: diaEvento,
  resultado: z.enum(RESULTADOS_TACTO, { errorMap: () => ({ message: "Resultado inválido" }) }),
  mesesGest: numero(z.number({ invalid_type_error: "Los meses de gestación deben ser un número" }).positive("Los meses de gestación deben ser mayores a 0").max(10, "Los meses de gestación no pueden superar 10")),
  fechaProbableParto: diaOpcional,
  metodo: z.enum(METODOS_TACTO, { errorMap: () => ({ message: "Método inválido" }) }).default("palpacion"),
  veterinario: texto(120),
  observ: texto(1000),
})
  .refine((v) => v.resultado === "preñada" || (v.mesesGest == null && v.fechaProbableParto == null), { message: "Solo una hembra preñada lleva meses de gestación y fecha de parto", path: ["mesesGest"] })
  .refine((v) => !v.fechaProbableParto || v.fechaProbableParto > v.fecha, { message: "La fecha probable de parto tiene que ser posterior al tacto", path: ["fechaProbableParto"] })
export type TactoInput = z.input<typeof tactoSchema>

/** Una cría del parto: la viva se da de alta como animal (spec 03 §3.8). */
export const criaSchema = z.object({
  resultado: z.enum(RESULTADOS_CRIA, { errorMap: () => ({ message: "Indicá si la cría nació viva o muerta" }) }),
  sexo: enumOpcional(["M", "F"] as const, "Sexo de la cría inválido"),
  pesoNacerKg: numero(z.number({ invalid_type_error: "El peso debe ser un número" }).positive("El peso debe ser mayor a 0").max(100, "El peso al nacer no puede superar 100 kg")),
  caravanaVisual: texto(30),
  caravanaRfid: texto(32),
}).refine((c) => c.resultado === "muerto" || !!c.sexo, { message: "Indicá el sexo de la cría viva", path: ["sexo"] })
export type CriaInput = z.input<typeof criaSchema>

export const paricionSchema = z.object({
  madreId: z.string({ required_error: "Elegí la madre" }).uuid("Elegí la madre"),
  padreId: idOpcional,
  padreExterno: texto(120),
  fecha: diaEvento,
  /** Aborto: se registra el evento sin crías. */
  aborto: z.boolean().default(false),
  crias: z.array(criaSchema).max(4, "Hasta 4 crías por parto").default([]),
  tipoParto: enumOpcional(TIPOS_PARTO, "Tipo de parto inválido"),
  dificultad: numero(z.number().int("La dificultad va de 1 a 5").min(1, "La dificultad va de 1 a 5").max(5, "La dificultad va de 1 a 5")),
  observ: texto(1000),
  /** Confirmación para un segundo parto de la misma madre el mismo día. */
  confirmarMellizo: z.boolean().default(false),
})
  .refine((v) => !(v.padreId && v.padreExterno), { message: "Indicá el padre del rodeo o uno externo, no ambos", path: ["padreExterno"] })
  .refine((v) => (v.aborto ? v.crias.length === 0 : v.crias.length > 0), { message: "Cargá al menos una cría (o marcá aborto)", path: ["crias"] })
export type ParicionInput = z.input<typeof paricionSchema>

export const desteteSchema = z.object({
  animalId: z.string({ required_error: "Elegí el animal" }).uuid("Elegí el animal"),
  fecha: diaEvento,
  pesoKg: numero(z.number({ invalid_type_error: "El peso debe ser un número" }).positive("El peso debe ser mayor a 0").max(1500)),
  edadDias: numero(z.number().int("La edad va en días enteros").positive("La edad debe ser mayor a 0").max(1500)),
  metodo: enumOpcional(METODOS_DESTETE, "Método de destete inválido"),
  loteDesteteId: idOpcional,
  observ: texto(1000),
})
export type DesteteInput = z.input<typeof desteteSchema>

export const toradaSchema = z.object({
  nombre: z.string({ required_error: "Poné un nombre" }).trim().min(2, "Poné un nombre").max(120),
  loteId: z.string({ required_error: "Elegí el grupo" }).uuid("Elegí el grupo"),
  fechaInicio: dia.refine((d) => d <= `${Number(hoyArgentina().slice(0, 4)) + 1}-12-31`, "El inicio es demasiado lejano"),
  fechaFin: diaOpcional,
  tipo: z.enum(TIPOS_TORADA, { errorMap: () => ({ message: "Tipo inválido" }) }),
  cantidadHembras: numero(z.number().int().positive().max(100_000)),
  cantidadMachos: numero(z.number().int().positive().max(10_000)),
  observ: texto(1000),
}).refine((v) => !v.fechaFin || v.fechaFin >= v.fechaInicio, { message: "El fin no puede ser anterior al inicio", path: ["fechaFin"] })
export type ToradaInput = z.input<typeof toradaSchema>

const diaFiltro = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional()
/** Filtros de los listados: siempre de un campo, paginados. */
export const filtrosReproduccionSchema = z.object({
  establecimientoId: z.string({ required_error: "Falta el campo" }).uuid("Campo inválido"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(60).optional().transform((v) => v || undefined),
  desde: diaFiltro,
  hasta: diaFiltro,
  hembraId: uuid.optional(),
  machoId: uuid.optional(),
  toradaId: uuid.optional(),
  tipo: z.enum(TIPOS_TORADA).optional(),
  resultado: z.string().max(20).optional(),
  /** Servicios todavía sin tacto (para vincular un tacto). */
  sinTacto: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  activa: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  /** Incluir los eventos anulados (se muestran tachados). */
  verAnulados: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
})
export type FiltrosReproduccion = z.output<typeof filtrosReproduccionSchema>

/** Búsqueda de animales para los selectores (activos del campo). */
export const busquedaAnimalesSchema = z.object({
  establecimientoId: z.string().uuid("Campo inválido"),
  sexo: z.enum(["M", "F"]).optional(),
  especieId: uuid.optional(),
  q: z.string().trim().max(60).optional().transform((v) => v || undefined),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Edición de datos no críticos: lo ausente no se toca; "" lo borra. */
const textoEdicion = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v === undefined ? undefined : v || null))
export const EDICION_POR_TIPO = {
  servicio: z.object({ toroNombre: textoEdicion(120), loteSemen: textoEdicion(60), inseminador: textoEdicion(120), observ: textoEdicion(1000) }).strict(),
  tacto: z.object({ veterinario: textoEdicion(120), observ: textoEdicion(1000) }).strict(),
  paricion: z.object({
    tipoParto: z.enum(TIPOS_PARTO).nullish(),
    dificultad: z.number().int().min(1).max(5).nullish(),
    observ: textoEdicion(1000),
  }).strict(),
  destete: z.object({ metodo: z.enum(METODOS_DESTETE).nullish(), observ: textoEdicion(1000) }).strict(),
} as const

export const anulacionSchema = z.object({
  motivo: z.string({ required_error: "Indicá por qué se anula" }).trim().min(3, "Indicá por qué se anula").max(500),
  /** Confirmación para anular un parto cuya cría ya está dada de alta. */
  aceptarCria: z.boolean().default(false),
})

/** Edición de una torada: cerrar (fecha de fin), toros asignados y datos. */
export const edicionToradaSchema = z.object({
  nombre: z.string().trim().min(2, "Poné un nombre").max(120).optional(),
  fechaFin: diaOpcional.optional(),
  machoIds: z.array(uuid).max(100, "Demasiados toros").optional(),
  // Ausente = no se toca; "" = se borra
  cantidadHembras: z.preprocess((v) => (v === "" ? null : typeof v === "string" ? Number(v) : v), z.number().int().positive().max(100_000).nullable().optional()),
  observ: textoEdicion(1000),
}).strict()
