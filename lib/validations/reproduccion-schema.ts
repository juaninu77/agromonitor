import { z } from "zod"

export const servicioSchema = z.object({
  hembraId: z.string().uuid("Selecciona una hembra"),
  machoId: z.string().uuid().optional(),
  toradaId: z.string().uuid().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  tipo: z.enum(["natural", "ia", "iatf"]),
  toroNombre: z.string().optional(),
  loteSemen: z.string().optional(),
  inseminador: z.string().optional(),
  observ: z.string().optional(),
})

export type ServicioFormData = z.infer<typeof servicioSchema>

export const tactoSchema = z.object({
  hembraId: z.string().uuid("Selecciona una hembra"),
  servicioId: z.string().uuid().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  resultado: z.enum(["preñada", "vacia", "dudosa", "absorcion"]),
  mesesGest: z.number().positive().optional(),
  fechaProbableParto: z.string().optional(),
  metodo: z.enum(["palpacion", "ecografia"]).default("palpacion"),
  veterinario: z.string().optional(),
  observ: z.string().optional(),
})

export type TactoFormData = z.infer<typeof tactoSchema>

export const paricionSchema = z.object({
  madreId: z.string().uuid("Selecciona la madre"),
  padreId: z.string().uuid().optional(),
  padreExterno: z.string().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  resultado: z.enum(["vivo", "muerto"]),
  pesoNacerKg: z.number().positive().optional(),
  tipoParto: z.enum(["normal", "asistido", "cesarea"]).optional(),
  dificultad: z.number().int().min(1).max(5).optional(),
  sexoCria: z.enum(["M", "F"]).optional(),
  observ: z.string().optional(),
})

export type ParicionFormData = z.infer<typeof paricionSchema>

export const toradaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  loteId: z.string().uuid("Selecciona un lote"),
  fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
  fechaFin: z.string().optional(),
  tipo: z.enum(["natural", "ia", "iatf", "mixto"]),
  cantidadHembras: z.number().int().positive().optional(),
  cantidadMachos: z.number().int().positive().optional(),
  observ: z.string().optional(),
})

export type ToradaFormData = z.infer<typeof toradaSchema>
