import { z } from "zod"
import {
  CATEGORIAS,
  CATEGORIA_TRANSFERENCIA,
  MEDIOS_PAGO,
  MONEDAS,
  SUBCATEGORIAS_IMPUESTO,
  TIPOS_CUENTA,
  TIPOS_MOVIMIENTO,
} from "./constantes"

// ============================================================
// Finanzas (servidor): cuentas, movimientos y transferencias.
// Los importes viajan como string decimal de punta a punta para no redondear
// dinero con float; se aceptan "1234,56" o números y se normalizan.
// ============================================================

const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? null : typeof v === "string" ? v.trim() || null : v),
    z.string().max(max, `Máximo ${max} caracteres`).nullable(),
  )

const uuidNullable = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().uuid("Identificador inválido").nullable())

/** "1.234,56", "1234.5" o 1234.5 → "1234.56" / "1234.5". */
export function normalizarImporte(v: unknown): unknown {
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : v
  if (typeof v !== "string") return v
  let s = v.trim().replace(/[$\s]/g, "")
  if (s === "") return undefined
  // Con coma decimal (formato es-AR) los puntos son separadores de miles
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  return s
}

const importeBase = z.preprocess(
  normalizarImporte,
  z
    .string({ required_error: "El importe es requerido", invalid_type_error: "Importe inválido" })
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Importe inválido: hasta 12 enteros y 2 decimales"),
)

/** Importe estrictamente positivo. */
export const importeSchema = importeBase.refine((v) => Number(v) > 0, "El importe debe ser mayor que cero")

/** Saldo inicial de una cuenta: puede ser 0 o negativo (descubierto, tarjeta). */
export const saldoSchema = z.preprocess(
  (v) => normalizarImporte(v) ?? "0",
  z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Saldo inválido: hasta 12 enteros y 2 decimales"),
)

const MAX_DIAS_FUTURO = 366

/** Fecha AAAA-MM-DD real (rechaza 30 de febrero), desde 2000 y hasta un año adelante. */
export const fechaFinanzasSchema = z
  .string({ required_error: "La fecha es requerida" })
  .trim()
  .transform((v) => v.slice(0, 10))
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Usá una fecha válida (AAAA-MM-DD)")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v
  }, "Fecha inexistente")
  .refine((v) => v >= "2000-01-01", "La fecha es demasiado antigua")
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + MAX_DIAS_FUTURO * 86_400_000, "La fecha está demasiado lejos en el futuro")

export const cuentaSchema = z
  .object({
    establecimientoId: z.string().uuid("Campo inválido"),
    nombre: z.string({ required_error: "El nombre es requerido" }).trim().min(1, "El nombre es requerido").max(80),
    tipo: z.enum(TIPOS_CUENTA, { errorMap: () => ({ message: "Tipo de cuenta inválido" }) }),
    moneda: z.enum(MONEDAS, { errorMap: () => ({ message: "Moneda inválida" }) }).default("ARS"),
    banco: textoOpcional(80),
    numero: textoOpcional(40),
    saldoInicial: saldoSchema.default("0"),
    activa: z.boolean().default(true),
    notas: textoOpcional(1000),
  })
  .strict()

/** En la edición el campo dueño no cambia. */
export const cuentaUpdateSchema = cuentaSchema.omit({ establecimientoId: true }).partial().strict()

const movimientoCampos = {
  cuentaId: z.string({ required_error: "Elegí una cuenta" }).uuid("Cuenta inválida"),
  tipo: z.enum(TIPOS_MOVIMIENTO, { errorMap: () => ({ message: "Tipo inválido: ingreso o egreso" }) }),
  categoria: z.string({ required_error: "Elegí una categoría" }).trim().min(1, "Elegí una categoría"),
  subcategoria: textoOpcional(40),
  fecha: fechaFinanzasSchema,
  importe: importeSchema,
  descripcion: z.string({ required_error: "La descripción es requerida" }).trim().min(1, "La descripción es requerida").max(180),
  contraparte: textoOpcional(180),
  cuit: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[-\s]/g, "") || null : v ?? null),
    z.string().regex(/^\d{11}$/, "CUIT: 11 dígitos").nullable(),
  ),
  medioPago: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(MEDIOS_PAGO, { errorMap: () => ({ message: "Medio de pago inválido" }) }).nullable(),
  ),
  notas: textoOpcional(1000),
  comprobanteId: uuidNullable,
}

type CamposCategoria = { tipo?: string; categoria?: string; subcategoria?: string | null }

/** La categoría debe corresponder al tipo y los impuestos llevan detalle. */
function validarCategoria(v: CamposCategoria, ctx: z.RefinementCtx) {
  if (!v.tipo || v.categoria === undefined) return
  if (v.categoria === CATEGORIA_TRANSFERENCIA) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoria"], message: "Las transferencias se registran desde «Transferir entre cuentas»" })
    return
  }
  if (!CATEGORIAS[v.tipo as keyof typeof CATEGORIAS]?.includes(v.categoria)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoria"], message: `Categoría inválida para un ${v.tipo}` })
    return
  }
  if (v.categoria === "impuestos") {
    if (!v.subcategoria || !(SUBCATEGORIAS_IMPUESTO as readonly string[]).includes(v.subcategoria)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subcategoria"], message: "Indicá qué impuesto es" })
    }
  } else if (v.subcategoria) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subcategoria"], message: "El detalle solo aplica a impuestos" })
  }
}

export const movimientoSchema = z
  .object({ establecimientoId: z.string().uuid("Campo inválido"), ...movimientoCampos })
  .strict()
  .superRefine(validarCategoria)

/**
 * Edición: reemplazo completo de los campos editables (tipo, categoría y
 * subcategoría se validan juntos, así que se envían siempre).
 */
export const movimientoUpdateSchema = z.object(movimientoCampos).strict().superRefine(validarCategoria)

export const transferenciaSchema = z
  .object({
    establecimientoId: z.string().uuid("Campo inválido"),
    cuentaOrigenId: z.string({ required_error: "Elegí la cuenta de origen" }).uuid("Cuenta inválida"),
    cuentaDestinoId: z.string({ required_error: "Elegí la cuenta de destino" }).uuid("Cuenta inválida"),
    fecha: fechaFinanzasSchema,
    importe: importeSchema,
    /** Solo si las monedas difieren (compra/venta de dólares): lo que entra en destino. */
    importeDestino: z.preprocess((v) => (v === "" || v === undefined ? null : v), importeSchema.nullable()),
    descripcion: textoOpcional(180),
    notas: textoOpcional(1000),
  })
  .strict()
  .refine((v) => v.cuentaOrigenId !== v.cuentaDestinoId, { path: ["cuentaDestinoId"], message: "Elegí dos cuentas distintas" })

export const filtroMovimientosSchema = z.object({
  establecimientoId: z.string().uuid().optional(),
  cuentaId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
  categoria: z.string().max(40).optional(),
  desde: fechaFinanzasSchema.optional(),
  hasta: fechaFinanzasSchema.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export const filtroResumenSchema = z.object({
  establecimientoId: z.string().uuid().optional(),
  desde: fechaFinanzasSchema,
  hasta: fechaFinanzasSchema,
})

export type CuentaInput = z.output<typeof cuentaSchema>
export type MovimientoInput = z.output<typeof movimientoSchema>
export type MovimientoUpdateInput = z.output<typeof movimientoUpdateSchema>
export type TransferenciaInput = z.output<typeof transferenciaSchema>
export type FiltroMovimientos = z.output<typeof filtroMovimientosSchema>
