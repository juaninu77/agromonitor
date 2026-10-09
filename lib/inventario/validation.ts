// Esquemas del inventario de insumos (compartidos por el formulario y la API).
import { z } from "zod"
import { hoyArgentina } from "./fechas"

const cantidad = z.coerce.number({ invalid_type_error: "La cantidad debe ser un número" }).finite().positive("La cantidad debe ser mayor a 0").max(10_000_000)
const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
/** Texto de edición parcial: ausente no se toca (undefined); "" o null lo borran. */
const textoEdicion = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v === undefined ? undefined : v || null))
const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)")

/** Tipos de insumo agrupados por categoría (los sanitarios tienen principio activo, dosis y retiro). */
export const CATEGORIAS_INSUMO = [
  { id: "sanitario", label: "Sanidad", tipos: ["vacuna", "antiparasitario", "antibiotico", "antiinflamatorio", "vitaminico"] },
  { id: "nutricion", label: "Nutrición", tipos: ["mineral", "suplemento", "alimento"] },
  { id: "agricola", label: "Agrícola", tipos: ["semilla", "fertilizante", "agroquimico"] },
  { id: "operacion", label: "Operación", tipos: ["combustible", "lubricante", "repuesto", "herramienta"] },
  { id: "otros", label: "Otros", tipos: ["otro"] },
] as const
export const TIPOS_PRODUCTO = ["vacuna", "antiparasitario", "antibiotico", "antiinflamatorio", "vitaminico", "mineral", "suplemento", "alimento", "semilla", "fertilizante", "agroquimico", "combustible", "lubricante", "repuesto", "herramienta", "otro"] as const
export type TipoProducto = (typeof TIPOS_PRODUCTO)[number]
export const TIPO_LABEL: Record<TipoProducto, string> = {
  vacuna: "Vacuna", antiparasitario: "Antiparasitario", antibiotico: "Antibiótico", antiinflamatorio: "Antiinflamatorio", vitaminico: "Vitamínico",
  mineral: "Mineral", suplemento: "Suplemento", alimento: "Alimento / ración", semilla: "Semilla", fertilizante: "Fertilizante", agroquimico: "Agroquímico",
  combustible: "Combustible", lubricante: "Lubricante", repuesto: "Repuesto", herramienta: "Herramienta", otro: "Otro",
}
/** Tipos que se aplican a animales (Sanidad): llevan principio activo, laboratorio, dosis y días de retiro. */
export const TIPOS_SANITARIOS: readonly string[] = ["vacuna", "antiparasitario", "antibiotico", "antiinflamatorio", "vitaminico", "mineral", "suplemento"]
export const esSanitario = (tipo: string) => TIPOS_SANITARIOS.includes(tipo)
export const etiquetaTipo = (tipo: string) => TIPO_LABEL[tipo as TipoProducto] ?? tipo

export const movimientoStockSchema = z.object({
  productoId: z.string().uuid("ID de producto inválido"),
  loteProductoId: z.string().uuid("ID de lote inválido").nullish().transform((v) => v ?? null),
  tipo: z.enum(["entrada", "salida", "ajuste"], { errorMap: () => ({ message: "Tipo debe ser entrada, salida o ajuste" }) }),
  /** Solo para ajustes: sumar (sobrante) o restar (faltante). */
  sentido: z.enum(["sumar", "restar"]).nullish().transform((v) => v ?? null),
  cantidad,
  motivo: texto(1000),
  /** Fecha del movimiento (día, hora de Argentina); por defecto, ahora. */
  fecha: fechaDia.nullish().transform((v) => v ?? null),
  clave: z.string().uuid().nullish().transform((v) => v ?? null),
}).strict()
  .refine((v) => v.tipo !== "ajuste" || !!v.sentido, { message: "Indicá si el ajuste suma o resta", path: ["sentido"] })
  .refine((v) => v.tipo === "ajuste" || !v.sentido, { message: "El sentido solo aplica a ajustes", path: ["sentido"] })
  .refine((v) => v.tipo !== "ajuste" || !!v.motivo, { message: "Un ajuste necesita un motivo (recuento, rotura, vencido…)", path: ["motivo"] })
  .refine((v) => !v.fecha || v.fecha <= hoyArgentina(), { message: "Un movimiento no puede tener fecha futura", path: ["fecha"] })

const decimal3 = z.coerce.number().finite().min(0, "No puede ser negativo").max(10_000_000)
/** Número opcional de formulario: "" o null lo borran (null); ausente no lo toca (undefined). */
const opcional = (base: z.ZodNumber) => z.preprocess((v) => (v === "" ? null : v), base.nullable().optional())

const datosProducto = {
  nombre: z.string().trim().min(1, "Ingresá el nombre").max(180),
  tipo: z.enum(TIPOS_PRODUCTO, { errorMap: () => ({ message: "Elegí un tipo de insumo" }) }),
  principioActivo: texto(180),
  laboratorio: texto(180),
  retiroDias: z.coerce.number().int().min(0, "No puede ser negativo").max(3650).default(0),
  dosisReferencia: texto(180),
  notas: texto(2000),
}
const configProducto = {
  unidad: z.string().trim().min(1, "Indicá la unidad").max(30),
  stockMinimo: opcional(z.coerce.number().finite().min(0, "No puede ser negativo").max(10_000_000)),
  costoReferencia: opcional(z.coerce.number().finite().min(0, "El costo no puede ser negativo").max(1e10)),
  monedaCosto: z.enum(["ARS", "USD"]),
}

/** Alta de producto (con su configuración de inventario). */
export const productoSchema = z.object({
  ...datosProducto,
  unidad: configProducto.unidad.default("unidades"),
  stockMinimo: configProducto.stockMinimo,
  costoReferencia: configProducto.costoReferencia,
  monedaCosto: configProducto.monedaCosto.default("ARS"),
  organizacionId: z.string().uuid().nullish(),
}).strict()

/** Edición del producto: datos y configuración de inventario (se cambia lo que viene). */
export const productoConfigSchema = z.object({
  nombre: datosProducto.nombre.optional(),
  tipo: datosProducto.tipo.optional(),
  principioActivo: textoEdicion(180),
  laboratorio: textoEdicion(180),
  retiroDias: z.coerce.number().int().min(0, "No puede ser negativo").max(3650).optional(),
  dosisReferencia: textoEdicion(180),
  notas: textoEdicion(2000),
  unidad: configProducto.unidad.optional(),
  stockMinimo: configProducto.stockMinimo,
  costoReferencia: configProducto.costoReferencia,
  monedaCosto: configProducto.monedaCosto.optional(),
  activo: z.boolean().optional(),
}).strict()

export const UNIDADES_SUGERIDAS = ["unidades", "dosis", "ml", "litros", "kg", "frascos", "bolsas", "cajas"]

export const loteSchema = z.object({
  /** Idempotencia del alta (el lote con cantidad genera la entrada al stock). */
  clave: z.string().uuid().nullish().transform((v) => v ?? null),
  nroLote: z.string().trim().min(1, "Se requiere el número de lote").max(80),
  vencimiento: fechaDia.nullish().transform((v) => v ?? null),
  proveedor: texto(180),
  proveedorId: z.string().uuid().nullish().transform((v) => v ?? null),
  cantidad: z.coerce.number().finite().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
  unidad: texto(30),
  costo: z.coerce.number().finite().min(0, "El costo no puede ser negativo").max(1e10).nullish().transform((v) => v ?? null),
}).strict()

/** Edición de un lote: sus datos (la cantidad cambia solo con movimientos). */
export const loteUpdateSchema = z.object({
  nroLote: z.string().trim().min(1, "Se requiere el número de lote").max(80).optional(),
  vencimiento: fechaDia.nullish(),
  // Ausente no se toca; "" lo borra
  proveedor: textoEdicion(180),
  costo: opcional(z.coerce.number().finite().min(0, "El costo no puede ser negativo").max(1e10)),
}).strict()

/** Anular un movimiento: genera el contramovimiento (no se borra historial). */
export const anulacionSchema = z.object({
  motivo: z.string().trim().min(3, "Indicá por qué se anula").max(500),
}).strict()
