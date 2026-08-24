import { describe, it, expect } from "vitest"
import { sanitizar, computarCambios } from "@/lib/audit/diff"

describe("sanitizar", () => {
  it("convierte Date a ISO string", () => {
    const d = new Date("2026-08-22T10:00:00.000Z")
    expect(sanitizar(d)).toBe("2026-08-22T10:00:00.000Z")
  })

  it("convierte Decimal (con toNumber/toFixed) a number", () => {
    const decimalFalso = {
      toNumber: () => 1234.5,
      toFixed: (n?: number) => (1234.5).toFixed(n),
    }
    expect(sanitizar(decimalFalso)).toBe(1234.5)
  })

  it("convierte BigInt a number", () => {
    expect(sanitizar(BigInt(10))).toBe(10)
  })

  it("sanea recursivamente objetos y arrays", () => {
    const entrada = {
      fecha: new Date("2026-01-01T00:00:00.000Z"),
      pesos: [{ toNumber: () => 50, toFixed: () => "50" }],
      nombre: "vaca",
    }
    expect(sanitizar(entrada)).toEqual({
      fecha: "2026-01-01T00:00:00.000Z",
      pesos: [50],
      nombre: "vaca",
    })
  })

  it("preserva null y undefined", () => {
    expect(sanitizar(null)).toBeNull()
    expect(sanitizar(undefined)).toBeUndefined()
  })
})

describe("computarCambios", () => {
  it("detecta solo los campos que cambiaron", () => {
    const antes = { id: "a", nombre: "vaca", peso: 300, estado: "activo" }
    const despues = { id: "a", nombre: "vaca", peso: 335, estado: "vendido" }
    expect(computarCambios(antes, despues)).toEqual({
      peso: { de: 300, a: 335 },
      estado: { de: "activo", a: "vendido" },
    })
  })

  it("ignora campos de ruido (createdAt/updatedAt)", () => {
    const antes = { id: "a", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") }
    const despues = { id: "a", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01") }
    expect(computarCambios(antes, despues)).toEqual({})
  })

  it("en un INSERT (antes null) marca todos los campos como nuevos", () => {
    const cambios = computarCambios(null, { id: "a", nombre: "toro" })
    expect(cambios).toEqual({
      id: { de: undefined, a: "a" },
      nombre: { de: undefined, a: "toro" },
    })
  })

  it("compara Decimals por su valor numérico, no por identidad de objeto", () => {
    const dec = (n: number) => ({ toNumber: () => n, toFixed: (d?: number) => n.toFixed(d) })
    const cambios = computarCambios({ precio: dec(100) }, { precio: dec(100) })
    expect(cambios).toEqual({})
    const cambios2 = computarCambios({ precio: dec(100) }, { precio: dec(120) })
    expect(cambios2).toEqual({ precio: { de: 100, a: 120 } })
  })
})
