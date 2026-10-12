import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), animales: vi.fn(), contar: vi.fn(), previos: vi.fn(), crear: vi.fn(), crearMuchos: vi.fn(), audit: vi.fn(), estados: vi.fn(),
}))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: async () => ({}), celosAInseminar: async () => [] }))
vi.mock("@/lib/reproduccion/estado", () => ({ estadosReproductivos: m.estados }))
vi.mock("@/lib/prisma", () => {
  const tx = { evtCelo: { create: m.crear, createMany: m.crearMuchos }, auditLog: { create: m.audit } }
  return {
    prisma: {
      animal: { findFirst: m.animal, findMany: m.animales },
      evtCelo: { count: (a: { where: { operacionId?: string } }) => (a.where.operacionId ? m.previos(a) : m.contar(a)), findMany: async () => [] },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { cargaRapidaCelos, registrarCelo } from "@/lib/reproduccion/celo"
import { calificarIntervalo, intervalosDeCelo, sugerenciaInseminacion } from "@/lib/reproduccion/validation"
import type { AuthContext } from "@/lib/api/with-auth"

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = u(1), H1 = u(3), H2 = u(4), M1 = u(5), CLAVE = u(6)
const ctx = (roles: string[]) => ({ userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" }, establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []) }) as unknown as AuthContext
const operario = ctx(["operario"])
const animal = (id: string, extra: object = {}) => ({ id, sexo: "F", estadoVital: "activo", especieId: "B", razaId: null, establecimientoId: EST, fechaNacimiento: new Date("2022-01-01"), caravanaVisual: `V${id.slice(-2)}`, cuig: null, caravanaRfid: null, especie: { nombre: "bovino" }, ...extra })
const ayer = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

beforeEach(() => {
  vi.resetAllMocks()
  m.estados.mockResolvedValue(new Map())
  m.contar.mockResolvedValue(0)
  m.previos.mockResolvedValue(0)
  m.crear.mockImplementation(async ({ data }: { data: object }) => ({ id: "C1", ...data }))
  m.crearMuchos.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
})

describe("regla AM/PM", () => {
  it("el celo de la mañana se insemina esa tarde; el de la tarde, a la mañana siguiente", () => {
    expect(sugerenciaInseminacion("2026-10-10", "manana")).toMatchObject({ fecha: "2026-10-10", momento: "tarde" })
    expect(sugerenciaInseminacion("2026-10-31", "tarde")).toMatchObject({ fecha: "2026-11-01", momento: "manana" })
  })
})

describe("intervalo entre celos", () => {
  it("agrupa los celos a menos de 3 días como uno solo", () => {
    expect(intervalosDeCelo(["2026-08-01", "2026-08-02", "2026-08-22", "2026-09-12"])).toEqual([null, null, 21, 21])
  })
  it("califica: regular, celo no detectado (doble), corto o irregular; ovinos con su ciclo", () => {
    expect(calificarIntervalo(21)).toBe("regular")
    expect(calificarIntervalo(42)).toBe("doble")
    expect(calificarIntervalo(10)).toBe("corto")
    expect(calificarIntervalo(30)).toBe("largo")
    expect(calificarIntervalo(17, "ovino")).toBe("regular")
    expect(calificarIntervalo(17, "bovino")).toBe("corto")
  })
})

describe("registrar un celo", () => {
  it("cualquier rol del campo lo registra y devuelve cuándo inseminar", async () => {
    m.animal.mockResolvedValue(animal(H1))
    const r = await registrarCelo(operario, { hembraId: H1, fecha: ayer(), momento: "tarde", metodo: "pintura" })
    expect(m.crear.mock.calls[0][0].data).toMatchObject({ hembraId: H1, momento: "tarde", metodo: "pintura", establecimientoId: EST })
    expect(r.sugerencia.momento).toBe("manana")
    expect(r.aviso).toBeNull()
    expect(m.audit).toHaveBeenCalled()
  })
  it("rechaza un macho y el mismo turno repetido", async () => {
    m.animal.mockResolvedValue(animal(M1, { sexo: "M" }))
    await expect(registrarCelo(operario, { hembraId: M1, fecha: ayer(), momento: "manana" })).rejects.toThrow(/macho/)
    m.animal.mockResolvedValue(animal(H1))
    m.contar.mockResolvedValue(1)
    await expect(registrarCelo(operario, { hembraId: H1, fecha: ayer(), momento: "manana" })).rejects.toMatchObject({ status: 409 })
  })
  it("avisa si la hembra figura preñada", async () => {
    m.animal.mockResolvedValue(animal(H1))
    m.estados.mockResolvedValue(new Map([[H1, { estado: "preñada", desde: "2026-08-01", fechaProbableParto: null }]]))
    const r = await registrarCelo(operario, { hembraId: H1, fecha: ayer(), momento: "manana" })
    expect(r.aviso).toMatch(/preñada/)
  })
  it("no acepta una fecha futura", async () => {
    await expect(registrarCelo(operario, { hembraId: H1, fecha: "2999-01-01", momento: "manana" })).rejects.toThrow()
  })
})

describe("carga rápida", () => {
  const base = { establecimientoId: EST, fecha: ayer(), momento: "manana", clave: CLAVE }
  it("identifica por caravana y por EID, omite machos y desconocidas, y registra una vez por hembra", async () => {
    m.animales.mockResolvedValue([animal(H1), animal(H2, { caravanaRfid: "982000123456789" }), animal(M1, { sexo: "M" })])
    const r = await cargaRapidaCelos(operario, { ...base, identificadores: ["v03", "982 000 123 456 789", `V${M1.slice(-2)}`, "XX9", "V03"] })
    expect(r.registrados).toBe(2)
    expect(m.crearMuchos.mock.calls[0][0].data.map((d: { hembraId: string }) => d.hembraId)).toEqual([H1, H2])
    expect(m.crearMuchos.mock.calls[0][0].data[0].operacionId).toBe(CLAVE)
    expect(r.omitidos.map((o) => o.motivo)).toEqual([expect.stringMatching(/macho/), expect.stringMatching(/No es un animal/)])
  })
  it("reintentar la misma carga no duplica", async () => {
    m.previos.mockResolvedValue(3)
    const r = await cargaRapidaCelos(operario, { ...base, identificadores: ["V03"] })
    expect(r).toMatchObject({ registrados: 3, repetido: true })
    expect(m.crearMuchos).not.toHaveBeenCalled()
  })
  it("sin ninguna hembra identificada, error", async () => {
    m.animales.mockResolvedValue([])
    await expect(cargaRapidaCelos(operario, { ...base, identificadores: ["XX"] })).rejects.toThrow(/XX/)
  })
  it("exige un rol del campo", async () => {
    await expect(cargaRapidaCelos(ctx([]), { ...base, identificadores: ["V03"] })).rejects.toMatchObject({ status: 403 })
  })
})
