import { describe, it, expect } from "vitest"
import {
  animalAltaSchema,
  animalActualizacionSchema,
  filaAltaMasivaSchema,
  altaMasivaSchema,
  parsearFecha,
  fechaDesdeSerialExcel,
} from "@/lib/validations/animal-schema"

const UUID = "11111111-1111-4111-8111-111111111111"
const base = { sexo: "M", razaId: UUID, categoriaId: UUID, caravanaVisual: "a-001" }

const errores = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message)

describe("animalAltaSchema (servidor)", () => {
  it("acepta un alta mínima y normaliza la caravana a mayúsculas", () => {
    const r = animalAltaSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.caravanaVisual).toBe("A-001")
      expect(r.data.origen).toBe("cria_propia")
      expect(r.data.esCabana).toBe(false)
    }
  })

  it("exige al menos una identificación", () => {
    const r = animalAltaSchema.safeParse({ sexo: "F", razaId: UUID, categoriaId: UUID, caravanaVisual: "  " })
    expect(r.success).toBe(false)
    expect(errores(r).join()).toMatch(/al menos una identificación/)
  })

  it("convierte strings vacíos en undefined", () => {
    const r = animalAltaSchema.safeParse({ ...base, cuig: "", otroId: "   ", notas: "" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.cuig).toBeUndefined()
      expect(r.data.otroId).toBeUndefined()
      expect(r.data.notas).toBeUndefined()
    }
  })

  it("normaliza el RFID y rechaza los inválidos", () => {
    const ok = animalAltaSchema.safeParse({ ...base, caravanaRfid: "982 0000 0000 0999" })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.caravanaRfid).toBe("982000000000999")
    const mal = animalAltaSchema.safeParse({ ...base, caravanaRfid: "ABC123" })
    expect(errores(mal).join()).toMatch(/RFID inválido/)
  })

  it("rechaza sexo, origen y castración fuera de dominio", () => {
    expect(errores(animalAltaSchema.safeParse({ ...base, sexo: "X" })).join()).toMatch(/sexo/i)
    expect(errores(animalAltaSchema.safeParse({ ...base, origen: "robado" })).join()).toMatch(/Origen inválido/)
    expect(errores(animalAltaSchema.safeParse({ ...base, estadoCastracion: "medio" })).join()).toMatch(/Castración/)
  })

  it("rechaza fecha de nacimiento futura o inválida y acepta dd/mm/yyyy", () => {
    expect(errores(animalAltaSchema.safeParse({ ...base, fechaNacimiento: "2031-01-01" })).join()).toMatch(/futura/)
    expect(errores(animalAltaSchema.safeParse({ ...base, fechaNacimiento: "31/02/2020" })).join()).toMatch(/inválida/)
    const ok = animalAltaSchema.safeParse({ ...base, fechaNacimiento: "15/03/2020" })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.fechaNacimiento?.toISOString().slice(0, 10)).toBe("2020-03-15")
  })

  it("valida peso y condición corporal", () => {
    expect(errores(animalAltaSchema.safeParse({ ...base, pesoInicial: -10 })).join()).toMatch(/peso debe ser mayor a 0/)
    expect(errores(animalAltaSchema.safeParse({ ...base, pesoInicial: 0 })).join()).toMatch(/peso/)
    expect(errores(animalAltaSchema.safeParse({ ...base, pesoInicial: 5000 })).join()).toMatch(/2000/)
    expect(errores(animalAltaSchema.safeParse({ ...base, pesoInicial: 300, ccInicial: 12 })).join()).toMatch(/condición corporal/)
    const ok = animalAltaSchema.safeParse({ ...base, pesoInicial: "280,5", ccInicial: "" })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.pesoInicial).toBe(280.5)
      expect(ok.data.ccInicial).toBeUndefined()
    }
  })

  it("trata NaN (input numérico vacío) como ausente", () => {
    const r = animalAltaSchema.safeParse({ ...base, pesoInicial: Number.NaN })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.pesoInicial).toBeUndefined()
  })
})

describe("animalActualizacionSchema", () => {
  it("es parcial y acepta pesoNuevo", () => {
    const r = animalActualizacionSchema.safeParse({ notas: "x", pesoNuevo: 310 })
    expect(r.success).toBe(true)
  })
  it("rechaza pesoNuevo negativo", () => {
    expect(animalActualizacionSchema.safeParse({ pesoNuevo: -1 }).success).toBe(false)
  })
})

describe("filaAltaMasivaSchema / altaMasivaSchema", () => {
  it("acepta catálogos por nombre", () => {
    const r = filaAltaMasivaSchema.safeParse({ sexo: "F", caravanaVisual: "v-10", raza: "Hereford", categoria: "vaca", lote: "Rodeo 1", fila: 3 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.fila).toBe(3)
  })
  it("limita la cantidad de filas", () => {
    expect(altaMasivaSchema.safeParse({ filas: [] }).success).toBe(false)
    expect(altaMasivaSchema.safeParse({ filas: new Array(1001).fill({}) }).success).toBe(false)
    expect(altaMasivaSchema.safeParse({ filas: [{}], dryRun: true }).success).toBe(true)
  })
})

describe("parsearFecha", () => {
  it("entiende ISO, dd/mm/yyyy, dd-mm-yy y seriales de Excel", () => {
    expect(parsearFecha("2024-06-01")?.toISOString().slice(0, 10)).toBe("2024-06-01")
    expect(parsearFecha("01/06/2024")?.toISOString().slice(0, 10)).toBe("2024-06-01")
    expect(parsearFecha("1-6-24")?.toISOString().slice(0, 10)).toBe("2024-06-01")
    expect(fechaDesdeSerialExcel(45444).toISOString().slice(0, 10)).toBe("2024-06-01")
    expect(parsearFecha(45444)?.toISOString().slice(0, 10)).toBe("2024-06-01")
    expect(parsearFecha("")).toBeNull()
    expect(parsearFecha("ayer")).toBeNull()
  })
})
