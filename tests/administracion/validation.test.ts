import { describe, it, expect } from "vitest"
import { comprobanteSchema, tramiteSchema, documentoSchema, validarArchivo, MAX_FILE_BYTES, nombreArchivoSeguro, fechaSchema } from "@/lib/administracion/validation"

const base = { establecimientoId: "7c4bb2af-2185-42d4-89cc-e5f759808ccc", titulo: "Prueba", referencia: "0001", notas: "", fecha: "2026-09-17" }
const invoice = { ...base, tipo: "factura", estado: "pendiente", contraparte: "Proveedor", importe: "123.45", moneda: "ARS", sentido: "egreso" }
describe("Administración: validación de entrada", () => {
  it("conserva el importe como decimal exacto", () => expect(comprobanteSchema.parse(invoice).importe).toBe("123.45"))
  it.each(["-1", "0", "1.001", "NaN", "1e6", "1234567890123", "1,50"])("rechaza importe %s sin redondear", importe => expect(comprobanteSchema.safeParse({ ...invoice, importe }).success).toBe(false))
  it("no acepta atributos arbitrarios del cliente", () => expect(comprobanteSchema.safeParse({ ...invoice, organizacionId: base.establecimientoId }).success).toBe(false))
  it("rechaza un vencimiento anterior a la emisión", () => expect(comprobanteSchema.safeParse({ ...invoice, vencimiento: "2026-09-16" }).success).toBe(false))
  it.each(["2026-02-30", "2026-13-01", "not-a-date"])("rechaza fecha %s", fecha => expect(fechaSchema.safeParse(fecha).success).toBe(false))
  it("acepta un día bisiesto real", () => expect(fechaSchema.parse("2024-02-29")).toBe("2024-02-29"))
  it("no permite inventar estados oficiales", () => expect(tramiteSchema.safeParse({ ...base, tipo: "renspa", estado: "emitido_por_senasa" }).success).toBe(false))
  it("permite un documento de campo sin vínculo", () => expect(documentoSchema.safeParse({ ...base, tipo: "contrato", estado: "activo" }).success).toBe(true))
  it("rechaza vínculos múltiples", () => expect(documentoSchema.safeParse({ ...base, tipo: "contrato", estado: "activo", activoId: base.establecimientoId, tramiteId: base.establecimientoId }).success).toBe(false))
})
describe("Archivos privados", () => {
  it("acepta PDF con firma correcta", () => expect(() => validarArchivo(new TextEncoder().encode("%PDF-1.7"), "application/pdf")).not.toThrow())
  it("rechaza HTML disfrazado de PDF", () => expect(() => validarArchivo(new TextEncoder().encode("<html>"), "application/pdf")).toThrow())
  it("rechaza SVG activo", () => expect(() => validarArchivo(new TextEncoder().encode("<svg/>"), "image/svg+xml")).toThrow())
  it("rechaza archivos vacíos", () => expect(() => validarArchivo(new Uint8Array(), "application/pdf")).toThrow())
  it("rechaza archivos demasiado grandes", () => expect(() => validarArchivo(new Uint8Array(MAX_FILE_BYTES + 1), "application/pdf")).toThrow())
  it("sanitiza rutas y caracteres de cabeceras", () => expect(nombreArchivoSeguro('../test\r\n";.pdf')).toBe("test____.pdf"))
})
