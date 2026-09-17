import { z } from "zod"

export const modulos = ["patrimonio", "comprobantes", "tramites", "documentos"] as const
export type Modulo = typeof modulos[number]
export const moduloSchema = z.enum(modulos)
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_ORG_BYTES = 100 * 1024 * 1024
export const tipos = {
  patrimonio: ["maquinaria", "vehiculo", "inmueble", "instalacion", "herramienta", "otro"],
  comprobantes: ["factura", "recibo", "nota_credito", "nota_debito", "comprobante_pago", "otro"],
  tramites: ["renspa", "dte", "vacunacion", "habilitacion", "otro"],
  documentos: ["escritura", "contrato", "factura", "comprobante", "senasa", "animal", "otro"],
} as const
export const estados = {
  patrimonio: ["activo", "vendido", "baja"],
  comprobantes: ["pendiente", "pagado", "anulado"],
  tramites: ["pendiente", "presentado", "aprobado", "rechazado", "cancelado"],
  documentos: ["activo", "archivado"],
} as const

const textoOpcional = z.string().trim().max(4000).nullish().transform(v => v || null)
const referencia = z.string().trim().max(120).nullish().transform(v => v || null)
// Reject impossible dates (JS otherwise normalizes e.g. February 30).
export const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usá una fecha válida")
  .refine(v => { const d = new Date(`${v}T00:00:00Z`); return !isNaN(+d) && d.toISOString().slice(0, 10) === v }, "Fecha inexistente")
const fechaOpcional = z.union([fechaSchema, z.literal("")]).nullish().transform(v => v || null)
// Decimal as a string end-to-end: never round silently or convert money to float.
export const importeSchema = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Importe positivo, hasta 12 enteros y 2 decimales")
  .refine(v => Number(v) > 0, "El importe debe ser mayor que cero")
const base = {
  establecimientoId: z.string().uuid(), titulo: z.string().trim().min(1).max(180),
  referencia, notas: textoOpcional,
}
const moneda = z.enum(["ARS", "USD"])
export const patrimonioSchema = z.object({ ...base, tipo: z.enum(tipos.patrimonio), estado: z.enum(estados.patrimonio),
  fecha: fechaOpcional, importe: z.union([importeSchema, z.literal("")]).nullish().transform(v => v || null), moneda,
}).strict()
export const comprobanteSchema = z.object({ ...base, tipo: z.enum(tipos.comprobantes), estado: z.enum(estados.comprobantes),
  referencia: z.string().trim().min(1).max(120), contraparte: z.string().trim().min(1).max(180),
  cuit: z.union([z.string().regex(/^\d{11}$/, "CUIT: 11 dígitos sin guiones"), z.literal("")]).nullish().transform(v => v || null),
  fecha: fechaSchema, vencimiento: fechaOpcional, importe: importeSchema, moneda, sentido: z.enum(["ingreso", "egreso"]),
}).strict().refine(v => !v.vencimiento || v.vencimiento >= v.fecha, { message: "El vencimiento no puede ser anterior a la fecha", path: ["vencimiento"] })
export const tramiteSchema = z.object({ ...base, tipo: z.enum(tipos.tramites), estado: z.enum(estados.tramites),
  fecha: fechaSchema, vencimiento: fechaOpcional,
}).strict().refine(v => !v.vencimiento || v.vencimiento >= v.fecha, { message: "El vencimiento no puede ser anterior a la fecha", path: ["vencimiento"] })
const vinculo = z.union([z.string().uuid(), z.literal("")]).nullish().transform(v => v || null)
export const documentoSchema = z.object({ ...base, tipo: z.enum(tipos.documentos), estado: z.enum(estados.documentos),
  fecha: fechaOpcional, vencimiento: fechaOpcional, activoId: vinculo, comprobanteId: vinculo, tramiteId: vinculo, animalId: vinculo,
}).strict().refine(v => [v.activoId, v.comprobanteId, v.tramiteId, v.animalId].filter(Boolean).length <= 1,
  "Elegí un único registro vinculado").refine(v => !v.fecha || !v.vencimiento || v.vencimiento >= v.fecha,
  { message: "El vencimiento no puede ser anterior a la fecha", path: ["vencimiento"] })

export function validarArchivo(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error("El archivo debe tener entre 1 byte y 2 MB")
  const prefix = (values: number[]) => values.every((v, i) => bytes[i] === v)
  const valid = (mime === "application/pdf" && prefix([37,80,68,70,45])) ||
    (mime === "image/png" && prefix([137,80,78,71,13,10,26,10])) ||
    (mime === "image/jpeg" && prefix([255,216,255]))
  if (!valid) throw new Error("Solo se admiten archivos PDF, JPG o PNG con contenido válido")
}

export function nombreArchivoSeguro(name: string) {
  return name.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f";]/g, "_").slice(0, 180) || "archivo"
}
