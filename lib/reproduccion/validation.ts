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
export const TIPOS_EVENTO = ["servicio", "tacto", "paricion", "destete", "senalada"] as const
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
  senalada: ["admin", "encargado", "operario"],
  /** Protocolos IATF: armarlos y registrar sus pasos (hormonas e inseminación) */
  iatf: ["admin", "encargado", "vet"],
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
  /** IA/IATF: pajuela del inventario (se descuenta 1) y, opcional, su partida */
  productoSemenId: idOpcional,
  loteProductoId: idOpcional,
  /** Confirmación para servir a una hembra que figura preñada. */
  aceptarPrenada: z.boolean().default(false),
}).refine((v) => v.tipo !== "natural" || !v.productoSemenId, { message: "La pajuela es solo para IA o IATF", path: ["productoSemenId"] })
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
  /** Un animal puntual (para precargar un formulario). */
  id: uuid.optional(),
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
  senalada: z.object({ observ: textoEdicion(1000) }).strict(),
} as const

export const anulacionSchema = z.object({
  motivo: z.string({ required_error: "Indicá por qué se anula" }).trim().min(3, "Indicá por qué se anula").max(500),
  /** Confirmación para anular un parto cuya cría ya está dada de alta. */
  aceptarCria: z.boolean().default(false),
  /** Destete: quitar también la pesada que se registró con él. */
  quitarPesada: z.boolean().default(true),
  /** Destete: volver el animal al grupo en el que estaba (si no se movió después). */
  volverGrupo: z.boolean().default(true),
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

// ─── Torada / encarnerada (spec 03 §3.3) ────────────────────────────────────

export const TIPOS_GRUPO = ["torada", "encarnerada"] as const
export type TipoGrupo = (typeof TIPOS_GRUPO)[number]
/** Ovinos y caprinos usan encarnerada con carneros; el resto, torada con toros. */
export const tipoGrupoDeEspecie = (especie: string | null | undefined): TipoGrupo =>
  ["ovino", "caprino"].includes((especie ?? "").toLowerCase()) ? "encarnerada" : "torada"
export const TERMINOS_GRUPO: Record<TipoGrupo, { grupo: string; grupos: string; macho: string; machos: string }> = {
  torada: { grupo: "Torada", grupos: "Toradas", macho: "Toro", machos: "Toros" },
  encarnerada: { grupo: "Encarnerada", grupos: "Encarneradas", macho: "Carnero", machos: "Carneros" },
}
/** En ovinos el servicio es solo natural (spec 03 §3.6). */
export const soloServicioNatural = (especie: string | null | undefined) => tipoGrupoDeEspecie(especie) === "encarnerada"

// ─── Cargas por grupo ───────────────────────────────────────────────────────

const clave = z.string({ required_error: "Falta la clave de la operación" }).uuid("Falta la clave de la operación")
const MAX_GRUPO = 3000

/** Servicio de las hembras de una torada en una operación (C1). */
export const servicioMasivoSchema = z.object({
  clave,
  toradaId: z.string({ required_error: "Elegí la torada" }).uuid("Elegí la torada"),
  fecha: diaEvento,
  tipo: z.enum(TIPOS_SERVICIO, { errorMap: () => ({ message: "Tipo de servicio inválido" }) }),
  /** Hembras elegidas; ausente = todas las del grupo ese día (monta natural). */
  hembraIds: z.array(uuid).min(1, "Elegí al menos una hembra").max(MAX_GRUPO).optional(),
  machoId: idOpcional,
  toroNombre: texto(120),
  loteSemen: texto(60),
  inseminador: texto(120),
  observ: texto(1000),
  /** Por defecto las que figuran preñadas se omiten. */
  incluirPrenadas: z.boolean().default(false),
  /** IA/IATF: pajuela del inventario (se descuenta 1 por hembra) y, opcional, su partida */
  productoSemenId: idOpcional,
  loteProductoId: idOpcional,
}).refine((v) => v.tipo === "natural" || !!v.hembraIds, { message: "En IA o IATF elegí las hembras inseminadas", path: ["hembraIds"] })
  .refine((v) => v.tipo !== "natural" || !v.productoSemenId, { message: "La pajuela es solo para IA o IATF", path: ["productoSemenId"] })

/** Planilla de tacto: un resultado por hembra (C2). */
export const tactoMasivoSchema = z.object({
  clave,
  fecha: diaEvento,
  metodo: z.enum(METODOS_TACTO).default("palpacion"),
  veterinario: texto(120),
  toradaId: idOpcional,
  filas: z.array(z.object({
    hembraId: uuid,
    resultado: z.enum(RESULTADOS_TACTO, { errorMap: () => ({ message: "Resultado inválido" }) }),
    mesesGest: numero(z.number().positive().max(10, "Los meses de gestación no pueden superar 10")),
  }).refine((f) => f.resultado === "preñada" || f.mesesGest == null, { message: "Solo una preñada lleva meses de gestación" }))
    .min(1, "Cargá al menos un resultado").max(MAX_GRUPO),
})

/** Destete de varios animales de un grupo (C3). */
export const desteteMasivoSchema = z.object({
  clave,
  fecha: diaEvento,
  metodo: enumOpcional(METODOS_DESTETE, "Método de destete inválido"),
  loteDesteteId: idOpcional,
  observ: texto(1000),
  filas: z.array(z.object({
    animalId: uuid,
    pesoKg: numero(z.number({ invalid_type_error: "El peso debe ser un número" }).positive("El peso debe ser mayor a 0").max(1500)),
  })).min(1, "Elegí al menos un animal").max(MAX_GRUPO),
})

const cantidad = (max = 100_000) => z.preprocess((v) => (v === "" || v == null ? 0 : typeof v === "string" ? Number(v) : v), z.number({ invalid_type_error: "Cantidad inválida" }).int("Cantidad inválida").min(0, "Cantidad inválida").max(max))

/** Señalada de corderos de un grupo (spec 03 §3.4). */
export const senaladaSchema = z.object({
  clave: uuid.optional(),
  loteId: z.string({ required_error: "Elegí el grupo" }).uuid("Elegí el grupo"),
  toradaId: idOpcional,
  fecha: diaEvento,
  corderosSenalados: z.preprocess((v) => (typeof v === "string" && v !== "" ? Number(v) : v), z.number({ required_error: "Indicá los corderos señalados", invalid_type_error: "Indicá los corderos señalados" }).int().min(1, "Indicá los corderos señalados").max(100_000)),
  corderosMuertos: cantidad(),
  machosMantenidos: cantidad(),
  machosCastrados: cantidad(),
  hembras: cantidad(),
  productoClostridialId: idOpcional,
  /** Cuánto de la vacuna se usó (en la unidad del producto): se descuenta del stock */
  descontarStock: numero(z.number({ invalid_type_error: "La cantidad a descontar no es válida" }).positive("La cantidad a descontar no es válida").max(10_000_000)),
  loteProductoId: idOpcional,
  aceptarVencido: z.boolean().default(false),
  observ: texto(1000),
}).refine((v) => v.descontarStock == null || v.productoClostridialId, { message: "Elegí la vacuna a descontar", path: ["productoClostridialId"] })
  .refine((v) => v.machosMantenidos + v.machosCastrados + v.hembras === 0 || v.machosMantenidos + v.machosCastrados + v.hembras === v.corderosSenalados, {
  message: "Machos enteros + castrados + hembras tiene que sumar los corderos señalados", path: ["hembras"],
})

// ─── Estado reproductivo (derivado de los eventos, nunca guardado) ──────────

export const ESTADOS_REPRODUCTIVOS = ["vacia", "servida", "preñada", "parida", "lactancia"] as const
export type EstadoReproductivo = (typeof ESTADOS_REPRODUCTIVOS)[number]
export const ETIQUETA_ESTADO_REPRODUCTIVO: Record<EstadoReproductivo, string> = { vacia: "Vacía", servida: "Servida", "preñada": "Preñada", parida: "Parida", lactancia: "En lactancia" }
/** Días de lactancia hasta el destete habitual (spec 03 §3.1–3.2). */
export const DIAS_LACTANCIA: Record<string, number> = { bovino: 180, ovino: 90, caprino: 90 }
const DIAS_PARIDA = 30

export interface HechosReproductivos {
  ultimoServicio: string | null
  ultimoTacto: { fecha: string; resultado: string; fechaProbableParto: string | null } | null
  ultimoParto: { fecha: string; resultado: string } | null
  /** La cría del último parto ya fue destetada. */
  criaDestetada: boolean
}
export interface EstadoDerivado { estado: EstadoReproductivo; desde: string; fechaProbableParto: string | null }

/**
 * Estado de una hembra según su último evento vigente: servicio → servida; tacto positivo →
 * preñada; tacto negativo o aborto → vacía; parto → parida (30 días) y luego en lactancia
 * hasta el destete de la cría (o los días de lactancia de la especie); sin eventos → null.
 */
export function derivarEstado(h: HechosReproductivos, hoy: string, especie?: string | null): EstadoDerivado | null {
  const candidatos = [
    h.ultimoParto && { tipo: "parto" as const, fecha: h.ultimoParto.fecha, peso: 3 },
    h.ultimoTacto && { tipo: "tacto" as const, fecha: h.ultimoTacto.fecha, peso: 2 },
    h.ultimoServicio ? { tipo: "servicio" as const, fecha: h.ultimoServicio, peso: 1 } : null,
  ].filter((c): c is NonNullable<typeof c> => !!c)
  if (!candidatos.length) return null
  // El más reciente; el mismo día, parto > tacto > servicio
  const u = candidatos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.peso - a.peso)[0]
  if (u.tipo === "servicio") return { estado: "servida", desde: u.fecha, fechaProbableParto: null }
  if (u.tipo === "tacto") {
    const r = h.ultimoTacto!.resultado
    if (r === "preñada") return { estado: "preñada", desde: u.fecha, fechaProbableParto: h.ultimoTacto!.fechaProbableParto }
    if (r === "dudosa") return { estado: "servida", desde: h.ultimoServicio ?? u.fecha, fechaProbableParto: null }
    return { estado: "vacia", desde: u.fecha, fechaProbableParto: null }
  }
  const p = h.ultimoParto!
  if (p.resultado === "aborto") return { estado: "vacia", desde: p.fecha, fechaProbableParto: null }
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${p.fecha}T00:00:00Z`)) / DIA_MS)
  if (dias <= DIAS_PARIDA) return { estado: "parida", desde: p.fecha, fechaProbableParto: null }
  const lactancia = DIAS_LACTANCIA[(especie ?? "").toLowerCase()] ?? DIAS_LACTANCIA.bovino
  if (p.resultado === "vivo" && !h.criaDestetada && dias <= lactancia) return { estado: "lactancia", desde: p.fecha, fechaProbableParto: null }
  return { estado: "vacia", desde: p.fecha, fechaProbableParto: null }
}

// ─── Protocolos IATF (Fase E3) ──────────────────────────────────────────────

/** Aplicar una plantilla IATF a hembras de una torada desde el día 0. */
export const protocoloIatfSchema = z.object({
  toradaId: z.string({ required_error: "Elegí la torada" }).uuid("Elegí la torada"),
  plantilla: z.string({ required_error: "Elegí el protocolo" }).min(1, "Elegí el protocolo").max(40),
  nombre: texto(120),
  /** Día 0 (puede ser futuro: el protocolo se planifica antes) */
  fechaD0: dia,
  hembraIds: z.array(uuid).min(1, "Elegí al menos una hembra").max(MAX_GRUPO),
  inseminador: texto(120),
  observ: texto(1000),
  /** Confirmación para incluir hembras que figuran preñadas */
  aceptarPrenadas: z.boolean().default(false),
})

/** Registrar un paso del protocolo: sus tratamientos (con producto) y, si es el último, la inseminación. */
export const pasoIatfSchema = z.object({
  clave,
  fecha: diaEvento,
  /** Hembras que recibieron el paso (por defecto, todas las del protocolo) */
  hembraIds: z.array(uuid).min(1, "Elegí al menos una hembra").max(MAX_GRUPO).optional(),
  tratamientos: z.array(z.object({
    /** Cuál de los tratamientos con producto del paso (orden de la plantilla) */
    indice: z.number().int().min(0).max(9),
    productoId: z.string({ required_error: "Elegí el producto" }).uuid("Elegí el producto"),
    dosis: numero(z.number().positive("La dosis debe ser mayor a 0").max(100_000)),
    unidad: texto(20),
    via: z.string().trim().max(30).nullish().transform((v) => v || null),
    /** Cantidad del stock por hembra (en la unidad del producto); vacío = no descontar */
    descontarPorAnimal: numero(z.number().positive("La cantidad a descontar no es válida").max(1_000_000)),
  })).max(10).default([]),
  inseminador: texto(120),
  productoSemenId: idOpcional,
  loteProductoId: idOpcional,
})
