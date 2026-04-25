import { z } from "zod"

export const eventoSanidadSchema = z.object({
  animalId: z.string().uuid().optional(),
  loteId: z.string().uuid().optional(),
  cantidadAnimales: z.number().int().positive().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  productoId: z.string().uuid("Selecciona un producto"),
  loteProductoId: z.string().uuid().optional(),
  dosis: z.number().positive().optional(),
  unidad: z.enum(["ml", "cc", "comprimido"]).optional(),
  via: z.enum(["subcutanea", "intramuscular", "oral", "pour-on"]).optional(),
  motivo: z.enum(["preventivo", "curativo", "metafilaxis"]).optional(),
  veterinario: z.string().optional(),
  observ: z.string().optional(),
})

export type EventoSanidadFormData = z.infer<typeof eventoSanidadSchema>

export const productoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  tipo: z.enum(["vacuna", "antiparasitario", "antibiotico", "mineral", "vitaminico", "otro"]),
  principioActivo: z.string().optional(),
  laboratorio: z.string().optional(),
  retiroDias: z.number().int().min(0).default(0),
  dosisReferencia: z.string().optional(),
  notas: z.string().optional(),
})

export type ProductoFormData = z.infer<typeof productoSchema>

export const loteProductoSchema = z.object({
  nroLote: z.string().min(1, "El numero de lote es requerido"),
  vencimiento: z.string().optional(),
  proveedor: z.string().optional(),
  cantidad: z.number().positive().optional(),
  unidad: z.string().optional(),
  costo: z.number().min(0).optional(),
})

export type LoteProductoFormData = z.infer<typeof loteProductoSchema>
