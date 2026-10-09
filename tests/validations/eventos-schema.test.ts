import { describe, expect, it } from "vitest"
import {
  ESTADO_VITAL_POR_MOTIVO,
  bajaSchema,
  movimientoLoteSchema,
  pesadaSchema,
} from "@/lib/validations/eventos-schema"

const animalId = "00000000-0000-4000-8000-000000000001"
const manana = new Date(Date.now() + 86_400_000 * 2).toISOString()

describe("pesadaSchema", () => {
  it("acepta bovinoId como alias, fecha dd/mm/aaaa y cc opcional", () => {
    const r = pesadaSchema.safeParse({ bovinoId: animalId, peso: "350,5", fecha: "01/03/2024", cc: "6" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.animalId).toBe(animalId)
      expect(r.data.peso).toBe(350.5)
      expect(r.data.cc).toBe(6)
      expect(r.data.fecha.getUTCMonth()).toBe(2)
    }
  })
  it("rechaza fecha futura, peso 0 y cc fuera de 1-9", () => {
    expect(pesadaSchema.safeParse({ animalId, peso: 300, fecha: manana }).success).toBe(false)
    expect(pesadaSchema.safeParse({ animalId, peso: 0, fecha: "2024-01-01" }).success).toBe(false)
    expect(pesadaSchema.safeParse({ animalId, peso: 300, cc: 12, fecha: "2024-01-01" }).success).toBe(false)
    expect(pesadaSchema.safeParse({ animalId, fecha: "2024-01-01" }).success).toBe(false)
  })
})

describe("movimientoLoteSchema", () => {
  it("deduplica ids y rechaza fecha futura", () => {
    const r = movimientoLoteSchema.safeParse({ animalIds: [animalId, animalId], loteDestinoId: animalId })
    expect(r.success && r.data.animalIds).toEqual([animalId])
    expect(movimientoLoteSchema.safeParse({ animalIds: [animalId], loteDestinoId: animalId, fecha: manana }).success).toBe(false)
  })
})

describe("bajaSchema", () => {
  it("valida motivo, importes no negativos y mapea el estado vital", () => {
    expect(bajaSchema.safeParse({ animalId, motivo: "perdido", fecha: "2024-01-01" }).success).toBe(false)
    expect(bajaSchema.safeParse({ animalId, motivo: "venta", fecha: "2024-01-01", precioKg: "-3" }).success).toBe(false)
    const r = bajaSchema.safeParse({ animalId, motivo: "venta", fecha: "2024-01-01", precioKg: "1500,50", pesoVivoKg: "420", clienteId: "" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.precioKg).toBe(1500.5)
      expect(r.data.clienteId).toBeUndefined()
    }
    expect(ESTADO_VITAL_POR_MOTIVO.venta).toBe("vendido")
    expect(ESTADO_VITAL_POR_MOTIVO.muerte).toBe("muerto")
    expect(ESTADO_VITAL_POR_MOTIVO.faena).toBe("baja")
  })
})
