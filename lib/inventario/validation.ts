// Esquemas del inventario de insumos (compartidos por el formulario y la API).
import { z } from "zod"
import { hoyArgentina } from "./fechas"

const cantidad = z.coerce.number({ invalid_type_error: "La cantidad debe ser un número" }).finite().positive("La cantidad debe ser mayor a 0").max(10_000_000)
const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)")

export const TIPOS_PRODUCTO = ["vacuna", "antiparasitario", "antibiotico", "mineral", "vitaminico", "otro"] as const

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

export const productoSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre").max(180),
  tipo: z.enum(TIPOS_PRODUCTO, { errorMap: () => ({ message: `Tipo inválido. Debe ser uno de: ${TIPOS_PRODUCTO.join(", ")}` }) }),
  principioActivo: texto(180),
  laboratorio: texto(180),
  retiroDias: z.coerce.number().int().min(0).max(3650).default(0),
  dosisReferencia: texto(180),
  notas: texto(2000),
  organizacionId: z.string().uuid().nullish(),
}).strict()

export const loteSchema = z.object({
  nroLote: z.string().trim().min(1, "Se requiere el número de lote").max(80),
  vencimiento: fechaDia.nullish().transform((v) => v ?? null),
  proveedor: texto(180),
  proveedorId: z.string().uuid().nullish().transform((v) => v ?? null),
  cantidad: z.coerce.number().finite().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
  unidad: texto(30),
  costo: z.coerce.number().finite().min(0, "El costo no puede ser negativo").max(1e10).nullish().transform((v) => v ?? null),
}).strict()

