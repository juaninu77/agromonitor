// Esquemas de Sanidad (compartidos por los formularios y la API; client-safe).
import { z } from "zod"
import { hoyArgentina } from "@/lib/inventario/fechas"

export const MOTIVOS_SANIDAD = ["preventivo", "curativo", "metafilaxis"] as const
export const VIAS_SANIDAD = ["subcutanea", "intramuscular", "oral", "pour-on", "topica", "intravenosa"] as const
export const ROLES_SANIDAD = ["admin", "encargado", "vet"] as const

export const ETIQUETA_MOTIVO: Record<(typeof MOTIVOS_SANIDAD)[number], string> = { preventivo: "Preventivo", curativo: "Curativo", metafilaxis: "Metafilaxis" }
export const ETIQUETA_VIA: Record<(typeof VIAS_SANIDAD)[number], string> = {
  subcutanea: "Subcutánea", intramuscular: "Intramuscular", oral: "Oral", "pour-on": "Pour-on", topica: "Tópica", intravenosa: "Intravenosa",
}

const uuid = z.string().uuid()
const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
/** Número de formulario: acepta "5,5"; vacío = sin dato. */
const numero = (base: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v), base.nullable()).optional().transform((v) => v ?? null)

/**
 * Día de la aplicación (AAAA-MM-DD). Un instante ISO se toma en hora de Argentina
 * (después de las 21 h, `toISOString()` ya es el día siguiente).
 */
export const diaSanidad = z.preprocess(
  (v) => (typeof v === "string" && v.length > 10 && !Number.isNaN(Date.parse(v)) ? hoyArgentina(new Date(v)) : v),
  z.string({ required_error: "La fecha es requerida" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
)

/** Campos comunes de una aplicación (individual, por grupo o masiva). */
const datosAplicacion = {
  productoId: z.string({ required_error: "Elegí un producto" }).uuid("Elegí un producto"),
  loteProductoId: uuid.nullish().transform((v) => v ?? null),
  fecha: diaSanidad,
  dosis: numero(z.number({ invalid_type_error: "La dosis debe ser un número" }).positive("La dosis debe ser mayor a 0").max(100_000)),
  unidad: texto(20),
  via: z.enum(VIAS_SANIDAD, { errorMap: () => ({ message: "Vía inválida" }) }).nullish().transform((v) => v ?? null),
  motivo: z.enum(MOTIVOS_SANIDAD, { errorMap: () => ({ message: "Motivo inválido" }) }).nullish().transform((v) => v ?? null),
  carenciaDias: numero(z.number().int().min(0, "La carencia no puede ser negativa").max(3650)),
  veterinario: texto(120),
  aplicador: texto(120),
  observ: texto(1000),
  /** Galpón de donde sale; ausente = donde más hay; null = sin galpón. */
  sectorStockId: uuid.nullable().optional(),
  aceptarVencido: z.boolean().default(false),
}

export const registroSanitarioSchema = z.object({
  animalId: uuid.nullish().transform((v) => v ?? null),
  loteId: uuid.nullish().transform((v) => v ?? null),
  cantidadAnimales: numero(z.number().int().positive().max(100_000)),
  ...datosAplicacion,
  costo: numero(z.number().min(0, "El costo no puede ser negativo").max(1e10)),
  /** Cantidad a descontar del stock, en la unidad del producto. */
  descontarStock: numero(z.number({ invalid_type_error: "La cantidad a descontar no es válida" }).positive("La cantidad a descontar no es válida").max(10_000_000)),
})
  .refine((v) => !!v.animalId !== !!v.loteId, { message: "Indicá un animal o un grupo (no ambos)", path: ["animalId"] })
  .refine((v) => v.fecha <= hoyArgentina(), { message: "La fecha no puede ser futura", path: ["fecha"] })
export type RegistroSanitarioInput = z.input<typeof registroSanitarioSchema>

const mesRegex = /^\d{4}-(0[1-9]|1[0-2])$/
export const ESPECIES_SANIDAD = ["bovino", "ovino", "equino", "caprino", "porcino"] as const

/** A quiénes se aplica una aplicación masiva: animales activos del campo que cumplan todos los filtros. */
export const destinoMasivoSchema = z.object({
  establecimientoId: z.string({ required_error: "Falta el campo" }).uuid("Campo inválido"),
  loteId: uuid.nullish().transform((v) => v || null),
  especie: z.string().trim().toLowerCase().max(30).nullish().transform((v) => v || null),
  categoriaId: uuid.nullish().transform((v) => v || null),
  sectorId: uuid.nullish().transform((v) => v || null),
})
export type DestinoMasivo = z.output<typeof destinoMasivoSchema>

export const aplicacionMasivaSchema = z.object({
  /** UUID del cliente: identifica la operación y hace idempotente el reintento. */
  clave: z.string({ required_error: "Falta la clave de la operación" }).uuid("Falta la clave de la operación"),
  destino: destinoMasivoSchema,
  ...datosAplicacion,
  /** Cantidad a descontar del stock POR ANIMAL, en la unidad del producto. */
  descontarPorAnimal: numero(z.number({ invalid_type_error: "La cantidad a descontar no es válida" }).positive("La cantidad a descontar no es válida").max(1_000_000)),
  /** Cantidad de animales que vio el usuario: si cambió, se pide confirmar de nuevo. */
  animalesEsperados: z.number().int().positive().max(20_000),
}).refine((v) => v.fecha <= hoyArgentina(), { message: "La fecha no puede ser futura", path: ["fecha"] })

export const anulacionSanitariaSchema = z.object({
  motivo: z.string({ required_error: "Indicá por qué se anula" }).trim().min(3, "Indicá por qué se anula").max(500),
})

/** Edición de datos no críticos: lo ausente no se toca; "" lo borra. */
const textoEdicion = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v === undefined ? undefined : v || null))
export const edicionSanitariaSchema = z.object({
  observ: textoEdicion(1000),
  veterinario: textoEdicion(120),
  aplicador: textoEdicion(120),
  via: z.enum(VIAS_SANIDAD).nullish(),
  motivo: z.enum(MOTIVOS_SANIDAD).nullish(),
}).strict().refine((v) => Object.values(v).some((x) => x !== undefined), { message: "No hay cambios para guardar" })

export const filtrosSanidadSchema = z.object({
  establecimientoId: uuid.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  motivo: z.enum(MOTIVOS_SANIDAD).optional(),
  productoId: uuid.optional(),
  loteId: uuid.optional(),
  animalId: uuid.optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  especie: z.string().trim().toLowerCase().max(30).optional().transform((v) => v || undefined),
  /** "1": incluir los anulados (por defecto no se muestran). */
  anulados: z.enum(["0", "1"]).optional(),
})
export type FiltrosSanidad = z.output<typeof filtrosSanidadSchema>

export const resumenSanidadSchema = z.object({
  establecimientoId: uuid,
  /** Mes del calendario (AAAA-MM); por defecto, el actual. */
  mes: z.string().regex(mesRegex, "Mes inválido").optional(),
})
