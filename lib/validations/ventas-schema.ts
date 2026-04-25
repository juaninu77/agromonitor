import { z } from "zod"

export const bajaSchema = z.object({
  animalId: z.string().uuid("Selecciona un animal"),
  fecha: z.string().min(1, "La fecha es requerida"),
  motivo: z.enum(["venta", "muerte", "faena", "descarte", "robo", "otro"]),
  pesoVivoKg: z.number().positive().optional(),
  precioKg: z.number().min(0).optional(),
  precioTotal: z.number().min(0).optional(),
  clienteId: z.string().uuid().optional(),
  dtaNumero: z.string().optional(),
  facturaNumero: z.string().optional(),
  observ: z.string().optional(),
})

export type BajaFormData = z.infer<typeof bajaSchema>

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  cuit: z.string().optional(),
  tipo: z.array(z.string()).min(1, "Selecciona al menos un tipo"),
  renspa: z.string().optional(),
  contactoNombre: z.string().optional(),
  contactoTel: z.string().optional(),
  notas: z.string().optional(),
})

export type ClienteFormData = z.infer<typeof clienteSchema>

export const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  cuit: z.string().optional(),
  tipo: z.array(z.string()).min(1, "Selecciona al menos un tipo"),
  contactoNombre: z.string().optional(),
  contactoTel: z.string().optional(),
  notas: z.string().optional(),
})

export type ProveedorFormData = z.infer<typeof proveedorSchema>

export const documentoTransitoSchema = z.object({
  numeroDta: z.string().min(1, "El numero es requerido"),
  tipo: z.enum(["DTA", "DTe"]).default("DTe"),
  fechaEmision: z.string().min(1, "La fecha de emision es requerida"),
  fechaVencimiento: z.string().min(1, "La fecha de vencimiento es requerida"),
  renspaOrigen: z.string().min(1, "El RENSPA de origen es requerido"),
  nombreOrigen: z.string().optional(),
  renspaDestino: z.string().min(1, "El RENSPA de destino es requerido"),
  nombreDestino: z.string().optional(),
  especie: z.string().min(1, "La especie es requerida"),
  cantidadAnimales: z.number().int().positive("La cantidad debe ser mayor a 0"),
  categorias: z.string().optional(),
  motivo: z.enum(["venta", "faena", "invernada", "cambio_campo"]),
  patenteCamion: z.string().optional(),
  transportista: z.string().optional(),
  observ: z.string().optional(),
})

export type DocumentoTransitoFormData = z.infer<typeof documentoTransitoSchema>
