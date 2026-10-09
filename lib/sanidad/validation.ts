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

export const registroSanitarioSchema = z.object({
  animalId: uuid.nullish().transform((v) => v ?? null),
  loteId: uuid.nullish().transform((v) => v ?? null),
  cantidadAnimales: numero(z.number().int().positive().max(100_000)),
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
  costo: numero(z.number().min(0, "El costo no puede ser negativo").max(1e10)),
  observ: texto(1000),
  /** Cantidad a descontar del stock, en la unidad del producto. */
  descontarStock: numero(z.number({ invalid_type_error: "La cantidad a descontar no es válida" }).positive("La cantidad a descontar no es válida").max(10_000_000)),
  /** Galpón de donde sale; ausente = donde más hay; null = sin galpón. */
  sectorStockId: uuid.nullable().optional(),
  aceptarVencido: z.boolean().default(false),
})
  .refine((v) => !!v.animalId !== !!v.loteId, { message: "Indicá un animal o un grupo (no ambos)", path: ["animalId"] })
  .refine((v) => v.fecha <= hoyArgentina(), { message: "La fecha no puede ser futura", path: ["fecha"] })
export type RegistroSanitarioInput = z.input<typeof registroSanitarioSchema>

const mesRegex = /^\d{4}-(0[1-9]|1[0-2])$/
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
})
export type FiltrosSanidad = z.output<typeof filtrosSanidadSchema>

export const resumenSanidadSchema = z.object({
  establecimientoId: uuid,
  /** Mes del calendario (AAAA-MM); por defecto, el actual. */
  mes: z.string().regex(mesRegex, "Mes inválido").optional(),
})
