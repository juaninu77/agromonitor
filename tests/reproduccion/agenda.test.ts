import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ raw: vi.fn(), crear: vi.fn(), completar: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: m.raw, tarea: { createMany: m.crear, updateMany: m.completar } },
}))
import { agendaReproductiva, sincronizarSiHaceFalta, sincronizarTareasReproductivas } from "@/lib/reproduccion/agenda"
import { indicadoresReproductivos } from "@/lib/reproduccion/indicadores"
import type { AuthContext } from "@/lib/api/with-auth"

const EST = "00000000-0000-4000-8000-000000000001"
const d = (s: string) => new Date(`${s}T00:00:00Z`)
/** Las consultas de la agenda, en orden: tactos, partos, señaladas, destetes y celos para inseminar. */
const consultas = (tactos: object[] = [], partos: object[] = [], senaladas: object[] = [], destetes: object[] = [], celos: object[] = []) =>
  m.raw.mockResolvedValueOnce(tactos).mockResolvedValueOnce(partos).mockResolvedValueOnce(senaladas).mockResolvedValueOnce(destetes).mockResolvedValueOnce(celos)

beforeEach(() => {
  vi.resetAllMocks()
  m.crear.mockResolvedValue({ count: 0 })
  m.completar.mockResolvedValue({ count: 0 })
})

describe("agenda reproductiva", () => {
  it("agrupa el tacto por torada (último servicio + 60 días bovino / 45 ovino) y deja suelto el de una hembra sin torada", async () => {
    consultas([
      { torada_id: "T1", torada: "Otoño", hembra_id: "H1", caravana: "V-1", especie: "bovino", ultimo: d("2026-09-01") },
      { torada_id: "T1", torada: "Otoño", hembra_id: "H2", caravana: "V-2", especie: "bovino", ultimo: d("2026-09-10") },
      { torada_id: null, torada: null, hembra_id: "H3", caravana: "O-3", especie: "ovino", ultimo: d("2026-09-20") },
    ])
    const a = await agendaReproductiva(EST, "2026-10-11")
    expect(a.map((p) => [p.clave, p.fecha, p.cantidad])).toEqual([
      ["tacto:hembra:H3:2026-09-20", "2026-11-04", 1],
      ["tacto:torada:T1", "2026-11-09", 2],
    ])
  })
  it("partos por grupo y mes, señalada a 30 días, destete a 180 / 90 días; atrasados marcados y lo lejano fuera", async () => {
    consultas([],
      [{ lote_id: "L1", lote: "Vacas", fpp: d("2026-10-20") }, { lote_id: "L1", lote: "Vacas", fpp: d("2026-10-05") }, { lote_id: "L1", lote: "Vacas", fpp: d("2027-03-01") }],
      [{ lote_id: "L2", lote: "Majada", primero: d("2026-09-01"), crias: 12 }],
      [{ lote_id: "L3", lote: "Terneros", mes: "2026-04", primero: d("2026-04-10"), crias: 30, especie: "bovino" }])
    const a = await agendaReproductiva(EST, "2026-10-11")
    expect(a.map((p) => [p.clave, p.fecha, p.vencida, p.cantidad])).toEqual([
      ["senalada:lote:L2:2026-09-01", "2026-10-01", true, 12],
      ["parto:lote:L1:2026-10", "2026-10-05", true, 2],
      ["destete:lote:L3:2026-04", "2026-10-07", true, 30],
    ])
  })
})

describe("inseminar después de un celo", () => {
  it("el celo reciente sin servicio queda en la agenda con la regla AM/PM; el de hace días ya no", async () => {
    consultas([], [], [], [], [
      { id: "C1", hembra_id: "H1", caravana: "V-1", fecha: d("2026-10-11"), momento: "manana", metodo: "observado" },
      { id: "C2", hembra_id: "H2", caravana: "V-2", fecha: d("2026-10-10"), momento: "tarde", metodo: "pintura" },
      { id: "C3", hembra_id: "H3", caravana: "V-3", fecha: d("2026-10-09"), momento: "manana", metodo: "observado" },
    ])
    const a = await agendaReproductiva(EST, "2026-10-11")
    expect(a.map((p) => [p.clave, p.tipo, p.fecha, p.vencida, p.animalId])).toEqual([
      ["ia:celo:C1", "celo", "2026-10-11", false, "H1"],
      ["ia:celo:C2", "celo", "2026-10-11", false, "H2"],
    ])
  })
  it("no se llevan a Tareas (la ventana es de horas)", async () => {
    consultas([], [], [], [], [{ id: "C1", hembra_id: "H1", caravana: "V-1", fecha: d("2026-10-11"), momento: "manana", metodo: "observado" }])
    await sincronizarTareasReproductivas(EST, "2026-10-11")
    expect(m.crear).not.toHaveBeenCalled()
  })
})

describe("tareas de la agenda", () => {
  it("crea las que vencen en 30 días sin duplicar y completa las que ya no están pendientes", async () => {
    consultas([{ torada_id: "T1", torada: "Otoño", hembra_id: "H1", caravana: "V-1", especie: "bovino", ultimo: d("2026-08-20") }],
      [{ lote_id: "L1", lote: "Vacas", fpp: d("2026-11-25") }])
    await sincronizarTareasReproductivas(EST, "2026-10-11")
    const creadas = m.crear.mock.calls[0][0]
    expect(creadas.skipDuplicates).toBe(true)
    // El tacto vence el 19/10 (entra); el parto del 25/11 todavía no (queda solo en la agenda)
    expect(creadas.data.map((t: { claveReproduccion: string }) => t.claveReproduccion)).toEqual(["tacto:torada:T1"])
    expect(creadas.data[0]).toMatchObject({ tipo: "reproduccion", estado: "pendiente", establecimientoId: EST })
    expect(m.completar.mock.calls[0][0].where).toMatchObject({ establecimientoId: EST, tipo: "reproduccion", claveReproduccion: { not: null, notIn: ["tacto:torada:T1", "parto:lote:L1:2026-11"] } })
  })
  it("si falla no rompe la operación que la llamó", async () => {
    m.raw.mockRejectedValue(new Error("db"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(sincronizarTareasReproductivas(EST)).resolves.toEqual({ creadas: 0, cumplidas: 0 })
  })
})

describe("puesta al día al abrir Tareas", () => {
  it("sincroniza cada campo como mucho una vez cada 10 minutos", async () => {
    m.raw.mockResolvedValue([])
    const OTRO = "00000000-0000-4000-8000-000000000002"
    expect(await sincronizarSiHaceFalta([EST, OTRO], 1_000_000)).toBe(2)
    expect(await sincronizarSiHaceFalta([EST, OTRO], 1_000_000 + 60_000)).toBe(0)
    expect(m.raw).toHaveBeenCalledTimes(10) // 5 consultas por campo
    expect(await sincronizarSiHaceFalta([EST], 1_000_000 + 10 * 60_000)).toBe(1)
  })
})

describe("indicadores por torada", () => {
  const ctx = { establecimientoIds: [EST] } as unknown as AuthContext
  it("calcula los porcentajes sobre las entoradas y deja vacío lo que todavía no tiene datos", async () => {
    m.raw.mockResolvedValueOnce([{
      id: "T1", nombre: "Otoño 2025", tipo: "natural", tipo_grupo: "torada", fecha_inicio: d("2025-04-01"), fecha_fin: d("2025-06-30"), cantidad_hembras: null,
      lote: "Vacas", especie: "bovino", servidas: 100, tactadas: 98, prenadas: 85, paridas: 80, abortos: 2, nacidos_vivos: 79, nacidos_muertos: 2,
      partos: 80, mellizos: 1, cabeza: 48, cuerpo: 24, cola: 8, destetados: 75, kg_destetados: 13500, senalados: 0, muertos_presenalada: 0,
    }, {
      id: "T2", nombre: "Otoño 2026", tipo: "natural", tipo_grupo: "torada", fecha_inicio: d("2026-04-01"), fecha_fin: null, cantidad_hembras: 120,
      lote: "Vacas", especie: "bovino", servidas: 110, tactadas: 0, prenadas: 0, paridas: 0, abortos: 0, nacidos_vivos: 0, nacidos_muertos: 0,
      partos: 0, mellizos: 0, cabeza: 0, cuerpo: 0, cola: 0, destetados: 0, kg_destetados: null, senalados: 0, muertos_presenalada: 0,
    }]).mockResolvedValueOnce([{ promedio: 371.4, casos: 40 }])
    const r = await indicadoresReproductivos(ctx, EST)
    const [t1, t2] = r.toradas
    expect(t1.porcentaje).toEqual({ prenez: 85, paricion: 80, destete: 75, senalada: null, mellizos: 1.3 })
    expect(t1.perdidas).toEqual({ tactoParto: 5.9, partoDestete: 5.1, preSenalada: null })
    expect(t1.distribucion).toEqual({ cabeza: 60, cuerpo: 30, cola: 10, partos: 80 })
    expect(t1.kgDestetadosPorHembra).toBe(135)
    // Torada en curso: entoradas cargadas a mano y nada calculable todavía
    expect(t2.entoradas).toBe(120)
    expect(t2.porcentaje.prenez).toBeNull()
    expect(t2.distribucion).toBeNull()
    expect(r.intervaloEntrePartos).toEqual({ dias: 371, casos: 40 })
  })
  it("un campo ajeno es 404", async () => {
    await expect(indicadoresReproductivos({ establecimientoIds: [] } as unknown as AuthContext, EST)).rejects.toMatchObject({ status: 404 })
  })
})
