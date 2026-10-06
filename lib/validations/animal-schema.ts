import { z } from "zod"
import { isValidEID, normalizeEID } from "@/lib/hardware/eid"

// ============================================================
// Dominios
// ============================================================

export const SEXOS_ANIMAL = ["M", "F"] as const
export const ORIGENES_ANIMAL = ["cria_propia", "compra", "otro"] as const
export const ESTADOS_CASTRACION = ["entero", "castrado"] as const
export const DENTICIONES = ["DL", "2D", "4D", "6D", "BL"] as const

/** Peso máximo plausible para un animal de producción (kg). */
export const PESO_MAX_KG = 2000
/** Condición corporal: escala 1 a 9 (la usada en todo el módulo). */
export const CC_MIN = 1
export const CC_MAX = 9
/** Edad máxima plausible: no aceptamos nacimientos de más de 30 años. */
const ANIOS_MAX_EDAD = 30

// ============================================================
// Helpers de preprocesado
// ============================================================

/** Texto opcional: recorta espacios y convierte "" / null en `undefined`. */
const textoOpcional = (max = 80) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined
      if (typeof v !== "string") return v
      const t = v.trim()
      return t === "" ? undefined : t
    },
    z.string().max(max, `Máximo ${max} caracteres`).optional(),
  )

/** Número opcional: acepta number o string numérico; "" / null → undefined. */
const numeroOpcional = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."))
    return Number.isNaN(n) ? v : n
  }
  if (typeof v === "number" && Number.isNaN(v)) return undefined
  return v
}, z.number({ invalid_type_error: "Debe ser un número" }).optional())

/** Convierte un serial de fecha de Excel (días desde 1899-12-30) a Date. */
export function fechaDesdeSerialExcel(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000)
}

/** Parsea fechas en ISO (yyyy-mm-dd), formato argentino (dd/mm/yyyy) o serial de Excel. */
export function parsearFecha(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor === "number") return fechaDesdeSerialExcel(valor)
  if (typeof valor !== "string") return null
  const t = valor.trim()
  if (!t) return null
  const ar = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (ar) {
    const [, d, m, y] = ar
    const anio = y.length === 2 ? 2000 + Number(y) : Number(y)
    const fecha = new Date(Date.UTC(anio, Number(m) - 1, Number(d)))
    return fecha.getUTCDate() === Number(d) && fecha.getUTCMonth() === Number(m) - 1 ? fecha : null
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const fecha = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    return fecha.getUTCDate() === Number(iso[3]) ? fecha : null
  }
  const libre = new Date(t)
  return Number.isNaN(libre.getTime()) ? null : libre
}

function finDeHoy(): Date {
  const hoy = new Date()
  hoy.setHours(23, 59, 59, 999)
  return hoy
}

/** Fecha opcional que no puede ser futura. Devuelve `Date` o `undefined`. */
export const fechaPasadaOpcional = (campo: string) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z
      .union([z.string(), z.number(), z.date()])
      .optional()
      .transform((v, ctx) => {
        if (v === undefined) return undefined
        const fecha = parsearFecha(v)
        if (!fecha) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${campo}: fecha inválida` })
          return z.NEVER
        }
        if (fecha.getTime() > finDeHoy().getTime()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${campo}: no puede ser una fecha futura` })
          return z.NEVER
        }
        const minimo = new Date()
        minimo.setFullYear(minimo.getFullYear() - ANIOS_MAX_EDAD)
        if (fecha.getTime() < minimo.getTime()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${campo}: demasiado antigua (más de ${ANIOS_MAX_EDAD} años)` })
          return z.NEVER
        }
        return fecha
      }),
  )

/** Caravana electrónica: tolera espacios/separadores y guarda el EID normalizado (15-16 dígitos). */
const rfidOpcional = textoOpcional(40).transform((v, ctx) => {
  if (v === undefined) return undefined
  if (!isValidEID(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "RFID inválido: debe tener 15 o 16 dígitos (ISO 11784/11785)" })
    return z.NEVER
  }
  return normalizeEID(v) as string
})

/** Caravana visual: se guarda en mayúsculas y sin espacios en los bordes para comparar duplicados. */
const caravanaVisualOpcional = textoOpcional(30).transform((v) => (v === undefined ? undefined : v.toUpperCase()))

export const pesoOpcional = numeroOpcional.refine((v) => v === undefined || (v > 0 && v <= PESO_MAX_KG), {
  message: `El peso debe ser mayor a 0 y hasta ${PESO_MAX_KG} kg`,
})

export const ccOpcional = numeroOpcional.refine((v) => v === undefined || (v >= CC_MIN && v <= CC_MAX), {
  message: `La condición corporal va de ${CC_MIN} a ${CC_MAX}`,
})

export const uuidOpcional = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z.string().uuid("Identificador inválido").optional(),
)

// ============================================================
// Alta de animal (servidor): POST /api/ganado/bovinos y alta masiva
// ============================================================

export const animalCamposSchema = z.object({
  establecimientoId: uuidOpcional,
  especieId: uuidOpcional,
  razaId: uuidOpcional,
  categoriaId: uuidOpcional,
  sexo: z.enum(SEXOS_ANIMAL, { errorMap: () => ({ message: "El sexo debe ser M o F" }) }),

  caravanaVisual: caravanaVisualOpcional,
  caravanaRfid: rfidOpcional,
  cuig: textoOpcional(30),
  otroId: textoOpcional(60),

  fechaNacimiento: fechaPasadaOpcional("Fecha de nacimiento"),
  /** Fecha de ingreso al campo: se usa para la pesada inicial y los historiales. Por defecto hoy. */
  fechaIngreso: fechaPasadaOpcional("Fecha de ingreso"),
  origen: z.enum(ORIGENES_ANIMAL, { errorMap: () => ({ message: "Origen inválido (cria_propia, compra u otro)" }) }).default("cria_propia"),
  proveedorId: uuidOpcional,

  colorManto: textoOpcional(60),
  estadoCastracion: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(ESTADOS_CASTRACION, { errorMap: () => ({ message: "Castración inválida (entero o castrado)" }) }).optional(),
  ),
  denticion: textoOpcional(10),
  esCabana: z.coerce.boolean().default(false),
  registroCabana: textoOpcional(60),
  notas: textoOpcional(2000),

  pesoInicial: pesoOpcional,
  ccInicial: ccOpcional,

  loteId: uuidOpcional,
  sectorId: uuidOpcional,
})

const exigirIdentificacion = (data: { caravanaVisual?: string; caravanaRfid?: string; cuig?: string; otroId?: string }, ctx: z.RefinementCtx) => {
  if (!data.caravanaVisual && !data.caravanaRfid && !data.cuig && !data.otroId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["caravanaVisual"],
      message: "Indicá al menos una identificación: caravana visual, RFID, CUIG u otro identificador",
    })
  }
}

export const animalAltaSchema = animalCamposSchema.superRefine(exigirIdentificacion)
export type AnimalAltaInput = z.input<typeof animalAltaSchema>
export type AnimalAlta = z.output<typeof animalAltaSchema>

// ============================================================
// Edición de animal (servidor): PATCH /api/ganado/bovinos/[id]
// ============================================================

export const animalActualizacionSchema = animalCamposSchema
  .omit({ establecimientoId: true, fechaIngreso: true, pesoInicial: true, ccInicial: true })
  .partial()
  .extend({
    /** Peso nuevo registrado al editar (crea una pesada con fecha de hoy). */
    pesoNuevo: pesoOpcional,
    ccNuevo: ccOpcional,
  })
export type AnimalActualizacion = z.output<typeof animalActualizacionSchema>

// ============================================================
// Alta masiva / importación: filas con ids o con nombres de catálogo
// ============================================================

/**
 * Una fila de alta masiva. Además de los ids, acepta los catálogos **por nombre**
 * (`especie`, `raza`, `categoria`, `lote`, `potrero`) para poder importar desde
 * una planilla. El servidor resuelve los nombres contra el catálogo del tenant.
 */
export const filaAltaMasivaSchema = animalCamposSchema.extend({
  fila: z.number().int().positive().optional(),
  especie: textoOpcional(40),
  raza: textoOpcional(60),
  categoria: textoOpcional(60),
  lote: textoOpcional(80),
  potrero: textoOpcional(80),
})
export type FilaAltaMasiva = z.output<typeof filaAltaMasivaSchema>

export const LIMITE_FILAS_ALTA_MASIVA = 1000

export const altaMasivaSchema = z.object({
  establecimientoId: uuidOpcional,
  /** Si es true, valida todo y no escribe nada (vista previa). */
  dryRun: z.boolean().default(false),
  filas: z
    .array(z.unknown())
    .min(1, "No hay filas para importar")
    .max(LIMITE_FILAS_ALTA_MASIVA, `Máximo ${LIMITE_FILAS_ALTA_MASIVA} animales por importación`),
})

// ============================================================
// Formulario cliente de edición (react-hook-form)
// ============================================================

export const animalFormSchema = z.object({
  especieId: z.string().uuid("Seleccioná una especie válida"),

  caravanaVisual: z.string().trim().optional(),
  caravanaRfid: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidEID(v), "El RFID debe tener 15 o 16 dígitos"),
  cuig: z.string().trim().optional(),
  otroId: z.string().trim().optional(),

  razaId: z.string().min(1, "La raza es requerida"),
  categoriaId: z.string().min(1, "La categoría es requerida"),
  sexo: z.enum(SEXOS_ANIMAL, { required_error: "El sexo es requerido" }),

  fechaNacimiento: z
    .string()
    .optional()
    .refine((v) => !v || (parsearFecha(v)?.getTime() ?? Infinity) <= finDeHoy().getTime(), "La fecha de nacimiento no puede ser futura"),
  origen: z.enum(ORIGENES_ANIMAL, { required_error: "El origen es requerido" }),

  colorManto: z.string().optional(),
  estadoCastracion: z.string().optional(),
  denticion: z.string().optional(),

  esCabana: z.boolean().default(false),
  registroCabana: z.string().optional(),

  pesoInicial: pesoOpcional,
  ccInicial: ccOpcional,

  sectorId: z.string().optional(),
  loteId: z.string().optional(),

  notas: z.string().optional(),
}).superRefine(exigirIdentificacion)

export type AnimalFormData = z.infer<typeof animalFormSchema>
