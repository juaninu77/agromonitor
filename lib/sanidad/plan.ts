// Plan sanitario: constantes, etiquetas y esquemas de protocolos e ítems (client-safe).

import { z } from "zod"

export const ZONAS_AFTOSA = ["libre_sin_vacunacion", "libre_con_vacunacion", "con_vacunacion"] as const
export type ZonaAftosa = (typeof ZONAS_AFTOSA)[number]
export const ETIQUETA_ZONA: Record<ZonaAftosa, string> = {
  libre_sin_vacunacion: "Libre sin vacunación (ZLSV)",
  libre_con_vacunacion: "Libre con vacunación",
  con_vacunacion: "Con vacunación",
}

export const MOMENTOS = ["inicio", "fecha", "campania_otono", "campania_primavera", "pre_servicio", "destete", "pre_esquila"] as const
export type Momento = (typeof MOMENTOS)[number]
export const ETIQUETA_MOMENTO: Record<Momento, string> = {
  inicio: "Inicio del calendario",
  fecha: "Fecha fija del año",
  campania_otono: "Campaña de otoño",
  campania_primavera: "Campaña de primavera",
  pre_servicio: "Inicio del servicio",
  destete: "Destete",
  pre_esquila: "Esquila",
}

export const ESPECIES_PLAN = ["bovino", "ovino", "caprino", "equino", "porcino"] as const

export interface ItemPlan {
  id?: string
  nombre: string
  momento: Momento
  mes: number | null
  dia: number | null
  diasOffset: number
  repetirCadaDias: number | null
  destinatarios: string | null
  productoTipo: string | null
  productoId: string | null
  dosis: number | null
  unidad: string | null
  via: string | null
  esAftosa: boolean
  obligatorio: boolean
  notas: string | null
}

/** "Campaña de otoño", "Campaña de otoño + 15 días", "15/03", "Cada 45 días desde el inicio". */
export function textoMomento(i: Pick<ItemPlan, "momento" | "mes" | "dia" | "diasOffset" | "repetirCadaDias">) {
  const base = i.momento === "fecha" && i.mes && i.dia ? `${String(i.dia).padStart(2, "0")}/${String(i.mes).padStart(2, "0")}` : ETIQUETA_MOMENTO[i.momento]
  const off = i.diasOffset ? ` ${i.diasOffset > 0 ? "+" : "−"} ${Math.abs(i.diasOffset)} días` : ""
  const rep = i.repetirCadaDias ? ` · cada ${i.repetirCadaDias} días` : ""
  return `${base}${off}${rep}`
}

const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const entero = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v) : v), z.number().int().min(min).max(max).nullable()).optional().transform((v) => v ?? null)

export const itemPlanSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string({ required_error: "Cada ítem necesita un nombre" }).trim().min(2, "Cada ítem necesita un nombre").max(160),
  momento: z.enum(MOMENTOS, { errorMap: () => ({ message: "Momento inválido" }) }),
  mes: entero(1, 12),
  dia: entero(1, 31),
  diasOffset: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(-365).max(365)),
  repetirCadaDias: entero(1, 365),
  destinatarios: texto(200),
  productoTipo: texto(40),
  productoId: z.string().uuid().nullish().transform((v) => v ?? null),
  dosis: z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number().positive().max(100_000).nullable()).optional().transform((v) => v ?? null),
  unidad: texto(20),
  via: texto(30),
  esAftosa: z.boolean().default(false),
  obligatorio: z.boolean().default(true),
  notas: texto(500),
}).refine((i) => i.momento !== "fecha" || (i.mes != null && i.dia != null), { message: "Una fecha fija necesita día y mes", path: ["mes"] })

export const protocoloSchema = z.object({
  nombre: z.string({ required_error: "Poné un nombre" }).trim().min(3, "Poné un nombre").max(120),
  descripcion: texto(500),
  especie: z.string().trim().toLowerCase().min(3).max(30),
  zonaAplicable: z.enum(ZONAS_AFTOSA).nullish().transform((v) => v ?? null),
})

export const crearProtocoloSchema = z.object({
  establecimientoId: z.string().uuid("Campo inválido"),
  /** Copiar una plantilla del sistema; sin plantilla se crea vacío con los datos dados. */
  plantilla: z.string().max(60).nullish().transform((v) => v || null),
  nombre: z.string().trim().max(120).nullish().transform((v) => v || null),
  especie: z.string().trim().toLowerCase().max(30).nullish().transform((v) => v || null),
})

export const edicionProtocoloSchema = protocoloSchema.partial().extend({
  activo: z.boolean().optional(),
  /** Si viene, reemplaza los ítems (los que traen id se actualizan, los demás se crean, los que faltan se borran). */
  items: z.array(itemPlanSchema).max(100).optional(),
}).strict()

export const zonaAftosaSchema = z.object({
  establecimientoId: z.string().uuid(),
  zonaAftosa: z.enum(ZONAS_AFTOSA).nullable(),
})

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
const diaOpcional = dia.nullish().or(z.literal("")).transform((v) => v || null)

/** Aplicar un protocolo a un campo (o a un grupo) para un año. */
export const calendarioSchema = z.object({
  establecimientoId: z.string().uuid("Campo inválido"),
  protocoloId: z.string({ required_error: "Elegí un protocolo" }).uuid("Elegí un protocolo"),
  anio: z.coerce.number().int().min(2000).max(2100),
  loteId: z.string().uuid().nullish().or(z.literal("")).transform((v) => v || null),
  fechaInicio: dia,
  fechaCampaniaOtono: diaOpcional,
  fechaCampaniaPrimavera: diaOpcional,
  fechaPreServicio: diaOpcional,
  fechaDestete: diaOpcional,
  fechaPreEsquila: diaOpcional,
  /** Solo calcula las tareas, sin guardar nada. */
  vistaPrevia: z.boolean().default(false),
}).refine((v) => v.fechaInicio.startsWith(String(v.anio)), { message: "El inicio tiene que ser del año del calendario", path: ["fechaInicio"] })
