import { describe, expect, it, vi } from "vitest"
import { avisoRetiroDte, retiroDeAnimal, retirosVigentes } from "@/lib/sanidad/retiro"

const fila = (animal_id: string, libera: string) => ({ animal_id, libera: new Date(`${libera}T00:00:00Z`), producto: "Ivermectina", fecha: new Date("2026-10-01T00:00:00Z") })
const db = (filas: unknown[]) => ({ $queryRaw: vi.fn().mockResolvedValue(filas) })
// Valores enviados a la consulta (Prisma.sql los parametriza: nada se concatena)
const valores = (d: ReturnType<typeof db>) => d.$queryRaw.mock.calls[0].slice(1).flatMap((v: unknown) => (v && typeof v === "object" && "values" in v ? (v as { values: unknown[] }).values : [v]))

describe("retiros vigentes", () => {
  it("devuelve la liberación por animal como día calendario", async () => {
    const d = db([fila("a1", "2026-11-05")])
    const m = await retirosVigentes(d, { establecimientoIds: ["e1"] }, "2026-10-10")
    expect(m.get("a1")).toEqual({ animalId: "a1", hasta: "2026-11-05", producto: "Ivermectina", fechaAplicacion: "2026-10-01" })
    expect(valores(d)).toContainEqual(["e1"])
  })
  it("sin animales ni campos no consulta", async () => {
    const d = db([])
    expect((await retirosVigentes(d, { animalIds: [] })).size).toBe(0)
    expect((await retirosVigentes(d, {})).size).toBe(0)
    expect(d.$queryRaw).not.toHaveBeenCalled()
  })
  it("un animal sin retiro vigente da null", async () => {
    expect(await retiroDeAnimal(db([]), "a1")).toBeNull()
  })
})

describe("aviso en DT-e", () => {
  it("solo los DT-e a faena con animales de esa especie bajo retiro piden confirmar", async () => {
    expect(await avisoRetiroDte(db([fila("a1", "2026-11-05")]), { establecimientoId: "e1", especie: "Bovino", motivo: "venta" })).toBeNull()
    expect(await avisoRetiroDte(db([]), { establecimientoId: "e1", especie: "Bovino", motivo: "faena" })).toBeNull()
    const d = db([fila("a1", "2026-11-05"), fila("a2", "2026-12-01")])
    const aviso = await avisoRetiroDte(d, { establecimientoId: "e1", especie: "Bovinos", motivo: "faena" })
    expect(aviso).toMatchObject({ cantidad: 2 })
    expect(aviso!.mensaje).toContain("01/12/2026")
    // "Bovinos" se normaliza a la especie del catálogo
    expect(valores(d)).toContain("bovino")
  })
})
