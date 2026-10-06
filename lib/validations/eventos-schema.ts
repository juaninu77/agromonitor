import { z } from "zod"
import { ccOpcional, fechaPasadaOpcional, pesoOpcional, uuidOpcional } from "@/lib/validations/animal-schema"

// ============================================================
// Eventos sobre animales (servidor): pesadas, sanidad, movimientos, bajas.
// Reglas comunes: la fecha no puede ser futura ni de más de 30 años; el
// animal debe estar activo (eso lo verifica la ruta contra la base).
// ============================================================

/** Fecha de evento obligatoria (acepta ISO, dd/mm/aaaa o serial de Excel). */
const fechaEvento = (campo: string) =>
  fechaPasadaOpcional(campo).transform((v, ctx) => {
    if (v === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${campo}: la fecha es requerida` })
      return z.NEVER
    }
    return v
  })

/** Fecha de evento opcional: si no viene, la ruta usa "ahora". */
const fechaEventoOpcional = (campo: string) => fechaPasadaOpcional(campo)

const texto = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? undefined : typeof v === "string" ? v.trim() || undefined : v),
    z.string().max(max, `Máximo ${max} caracteres`).optional(),
  )

/** Acepta `animalId` o el histórico `bovinoId`. */
const animalIdDesdeBody = z
  .object({ animalId: uuidOpcional, bovinoId: uuidOpcional })
  .passthrough()
  .transform((b) => ({ ...b, animalId: b.animalId ?? b.bovinoId }))

export const pesadaSchema = animalIdDesdeBody.pipe(
  z.object({
    animalId: z.string({ required_error: "El animal es requerido" }).uuid("ID de animal inválido"),
    peso: pesoOpcional.refine((v) => v !== undefined, { message: "El peso es requerido" }),
    cc: ccOpcional,
    fecha: fechaEvento("Fecha de pesada"),
    notas: texto(500),
    balanza: texto(60),
  }),
)
export type PesadaInput = z.output<typeof pesadaSchema>

export const TIPOS_EVENTO_SANITARIO = ["vacunacion", "desparasitacion", "tratamiento", "curacion", "otro"] as const
export const VIAS_APLICACION = ["subcutanea", "intramuscular", "oral", "pour-on", "topica", "intravenosa"] as const

export const eventoSanitarioSchema = animalIdDesdeBody.pipe(
  z
    .object({
      animalId: z.string({ required_error: "El animal es requerido" }).uuid("ID de animal inválido"),
      tipoEvento: z.enum(TIPOS_EVENTO_SANITARIO).default("otro"),
      descripcion: texto(500),
      fecha: fechaEvento("Fecha del evento"),
      /** Id de producto del catálogo (org o global). */
      productoId: uuidOpcional,
      /** Nombre de producto (texto libre): se busca o se crea en la organización. */
      producto: texto(120),
      dosis: z.preprocess(
        (v) => (v === null || v === undefined || v === "" ? undefined : typeof v === "string" ? Number(v.replace(",", ".")) : v),
        z.number({ invalid_type_error: "La dosis debe ser un número" }).positive("La dosis debe ser mayor a 0").max(100000).optional(),
      ),
      unidad: texto(20),
      via: z.enum(VIAS_APLICACION).optional(),
      veterinario: texto(120),
      costo: z.preprocess(
        (v) => (v === null || v === undefined || v === "" ? undefined : typeof v === "string" ? Number(v.replace(",", ".")) : v),
        z.number().min(0, "El costo no puede ser negativo").optional(),
      ),
    })
    .superRefine((e, ctx) => {
      if (!e.productoId && !e.producto && !e.descripcion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indicá el producto aplicado o una descripción del evento",
          path: ["descripcion"],
        })
      }
    }),
)
export type EventoSanitarioInput = z.output<typeof eventoSanitarioSchema>

export const movimientoLoteSchema = z.object({
  animalIds: z
    .array(z.string().uuid("ID de animal inválido"))
    .min(1, "Seleccioná al menos un animal")
    .max(500, "Máximo 500 animales por movimiento")
    .transform((ids) => [...new Set(ids)]),
  loteDestinoId: z.string().uuid("Lote destino inválido"),
  fecha: fechaEventoOpcional("Fecha del movimiento"),
  motivo: texto(200),
})
export type MovimientoLoteInput = z.output<typeof movimientoLoteSchema>

export const MOTIVOS_BAJA = ["venta", "muerte", "faena", "descarte", "robo", "otro"] as const
export type MotivoBaja = (typeof MOTIVOS_BAJA)[number]

/** Estado vital que queda en el animal según el motivo de la baja. */
export const ESTADO_VITAL_POR_MOTIVO: Record<MotivoBaja, "vendido" | "muerto" | "baja"> = {
  venta: "vendido",
  muerte: "muerto",
  faena: "baja",
  descarte: "baja",
  robo: "baja",
  otro: "baja",
}

const dinero = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? undefined : typeof v === "string" ? Number(v.replace(",", ".")) : v),
  z.number({ invalid_type_error: "Debe ser un número" }).min(0, "No puede ser negativo").optional(),
)

export const bajaSchema = z.object({
  animalId: z.string({ required_error: "El animal es requerido" }).uuid("ID de animal inválido"),
  motivo: z.enum(MOTIVOS_BAJA, { errorMap: () => ({ message: `Motivo inválido. Opciones: ${MOTIVOS_BAJA.join(", ")}` }) }),
  fecha: fechaEvento("Fecha de baja"),
  pesoVivoKg: pesoOpcional,
  precioKg: dinero,
  precioTotal: dinero,
  dtaNumero: texto(60),
  facturaNumero: texto(60),
  observ: texto(500),
  clienteId: uuidOpcional,
})
export type BajaInput = z.output<typeof bajaSchema>
