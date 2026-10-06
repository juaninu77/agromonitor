import { describe, it, expect, vi } from "vitest"

// El servicio importa prisma; para los helpers puros no hace falta base.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { duplicadosEnLote, resolverCatalogo, identificacionDe, mapearErrorPrisma } from "@/lib/ganado/alta"
import { Prisma } from "@prisma/client"

describe("duplicadosEnLote", () => {
  it("detecta caravanas, RFID y CUIG repetidos sin distinguir mayúsculas", () => {
    const dups = duplicadosEnLote([
      { caravanaVisual: "A-1", caravanaRfid: "982000000000001" },
      { caravanaVisual: "a-1" },
      { caravanaVisual: "B-2", caravanaRfid: "982000000000001", cuig: "X1" },
      { cuig: "x1" },
    ])
    expect(dups.get(0)).toBeUndefined()
    expect(dups.get(1)?.[0]).toMatch(/caravana visual "a-1" repetida en la fila 1/)
    expect(dups.get(2)?.[0]).toMatch(/RFID .* repetid[ao] en la fila 1/)
    expect(dups.get(3)?.[0]).toMatch(/CUIG "x1" repetida en la fila 3/)
  })

  it("ignora los valores vacíos", () => {
    expect(duplicadosEnLote([{}, {}, { caravanaVisual: undefined }]).size).toBe(0)
  })
})

describe("resolverCatalogo", () => {
  const razas = [
    { id: "r1", nombre: "Angus Negro" },
    { id: "r2", nombre: "Hereford" },
  ]
  it("resuelve por id, por nombre o por el texto que llegó en el campo id", () => {
    expect(resolverCatalogo(razas, "r2", undefined)?.id).toBe("r2")
    expect(resolverCatalogo(razas, undefined, "  angus negro ")?.id).toBe("r1")
    expect(resolverCatalogo(razas, "HEREFORD", undefined)?.id).toBe("r2")
    expect(resolverCatalogo(razas, undefined, "Brangus")).toBeUndefined()
    expect(resolverCatalogo(razas, undefined, undefined)).toBeUndefined()
  })
})

describe("identificacionDe", () => {
  it("prefiere caravana, luego RFID, CUIG y otro id", () => {
    expect(identificacionDe({ caravanaVisual: "A-1", caravanaRfid: "9" })).toBe("A-1")
    expect(identificacionDe({ caravanaRfid: "982000000000001" })).toBe("982000000000001")
    expect(identificacionDe({})).toBe("(sin identificación)")
  })
})

describe("mapearErrorPrisma", () => {
  const p2002 = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { target } })
  it("traduce P2002 a 409 sin revelar el otro tenant", () => {
    expect(mapearErrorPrisma(p2002(["establecimiento_id", "caravana_visual"]))).toEqual({
      status: 409,
      error: "Ya existe un animal con esa caravana en este campo",
    })
    expect(mapearErrorPrisma(p2002(["caravana_rfid"]))?.error).toMatch(/RFID/)
    expect(mapearErrorPrisma(p2002(["cuig"]))?.error).toMatch(/CUIG/)
  })
  it("devuelve null para errores desconocidos", () => {
    expect(mapearErrorPrisma(new Error("x"))).toBeNull()
  })
})
