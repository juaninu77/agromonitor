import { z } from "zod"

export const animalFormSchema = z.object({
  // Identificación
  caravanaVisual: z.string().min(1, "La caravana visual es requerida"),
  caravanaRfid: z.string().optional(),
  cuig: z.string().optional(),
  otroId: z.string().optional(),

  // Información básica
  razaId: z.string().min(1, "La raza es requerida"),
  categoriaId: z.string().min(1, "La categoría es requerida"),
  sexo: z.enum(["M", "F"], {
    required_error: "El sexo es requerido",
  }),

  // Fechas y origen
  fechaNacimiento: z.string().optional(),
  origen: z.enum(["cria_propia", "compra", "otro"], {
    required_error: "El origen es requerido",
  }),

  // Características físicas
  colorManto: z.string().optional(),
  estadoCastracion: z.string().optional(),
  denticion: z.string().optional(),

  // Cabaña
  esCabana: z.boolean().default(false),
  registroCabana: z.string().optional(),

  // Peso inicial (opcional)
  pesoInicial: z.number().optional(),
  ccInicial: z.number().min(1).max(9).optional(),

  // Ubicación (opcional)
  sectorId: z.string().optional(),
  loteId: z.string().optional(),

  // Notas
  notas: z.string().optional(),
})

export type AnimalFormData = z.infer<typeof animalFormSchema>
