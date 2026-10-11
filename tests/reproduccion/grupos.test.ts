import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  torada: vi.fn(), animales: vi.fn(), estados: vi.fn(), serviciosDia: vi.fn(), previos: vi.fn(), crearMuchos: vi.fn(), crear: vi.fn(), audit: vi.fn(),
  tactosDia: vi.fn(), servicios: vi.fn(), destetados: vi.fn(), lote: vi.fn(), senaladaPrevia: vi.fn(), toradaCount: vi.fn(), productoCount: vi.fn(),
  histAbiertos: vi.fn(), histCerrar: vi.fn(), histCrear: vi.fn(),
}))
vi.mock("@/lib/reproduccion/estado", () => ({ estadosReproductivos: m.estados }))
vi.mock("@/lib/prisma", () => {
  const tabla = (t: string) => ({ create: (a: { data: object }) => m.crear(t, a.data), createMany: (a: { data: object[] }) => m.crearMuchos(t, a.data) })
  const tx = {
    evtServicio: tabla("servicio"), evtTacto: tabla("tacto"), evtDestete: tabla("destete"), evtPesada: tabla("pesada"),
    evtSenalada: { create: async (a: { data: object }) => ({ id: "S1", ...(await m.crear("senalada", a.data)), ...a.data }) },
    animalLoteHist: { findMany: m.histAbiertos, updateMany: m.histCerrar, create: m.histCrear },
    auditLog: { create: m.audit },
  }
  return {
    prisma: {
      torada: { findFirst: m.torada, count: m.toradaCount },
      animal: { findMany: m.animales, count: vi.fn() },
      evtServicio: { count: m.previos, findMany: async (a: { where: { tipo?: string } }) => (a.where.tipo ? m.serviciosDia(a) : m.servicios(a)) },
      evtTacto: { count: m.previos, findMany: m.tactosDia },
      evtDestete: { count: m.previos, findMany: m.destetados },
      evtSenalada: { findUnique: m.senaladaPrevia },
      lote: { findFirst: m.lote },
      producto: { count: m.productoCount },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { desteteMasivo, registrarSenalada, servicioMasivo, tactoMasivo, calificarSenalada } from "@/lib/reproduccion/grupos"
import { derivarEstado, senaladaSchema, servicioMasivoSchema } from "@/lib/reproduccion/validation"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = uuid(1), TORADA = uuid(2), LOTE = uuid(3), CLAVE = uuid(4), BOV = uuid(5), H1 = uuid(11), H2 = uuid(12), H3 = uuid(13)
const rol = (roles: string[]) => ({
  userId: "u1", establecimientoIds: [EST], organizacionIds: ["o1"], organizacionDeEstablecimiento: { [EST]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []),
}) as unknown as AuthContext
const operario = rol(["operario"]), vet = rol(["vet"])
const hembra = (id: string, extra: object = {}) => ({
  id, sexo: "F", estadoVital: "activo", especieId: BOV, razaId: null, establecimientoId: EST, fechaNacimiento: new Date("2020-01-01"),
  caravanaVisual: `V-${id.slice(-2)}`, cuig: null, caravanaRfid: null, especie: { nombre: "bovino" }, ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
  m.previos.mockResolvedValue(0)
  m.estados.mockResolvedValue(new Map())
  m.serviciosDia.mockResolvedValue([])
  m.servicios.mockResolvedValue([])
  m.tactosDia.mockResolvedValue([])
  m.destetados.mockResolvedValue([])
  m.histAbiertos.mockResolvedValue([])
  m.torada.mockResolvedValue({
    id: TORADA, nombre: "Otoño", tipo: "natural", tipoGrupo: "torada", fechaInicio: new Date("2026-04-01"), fechaFin: null, loteId: LOTE, cantidadHembras: null,
    lote: { id: LOTE, nombre: "Vacas", establecimientoId: EST, especieId: BOV, especie: { nombre: "bovino" } },
  })
})

describe("estado reproductivo derivado", () => {
  const h = (x: object) => ({ ultimoServicio: null, ultimoTacto: null, ultimoParto: null, criaDestetada: false, ...x })
  it("sigue al último evento", () => {
    expect(derivarEstado(h({}), "2026-10-01")).toBeNull()
    expect(derivarEstado(h({ ultimoServicio: "2026-05-01" }), "2026-10-01")).toMatchObject({ estado: "servida" })
    expect(derivarEstado(h({ ultimoServicio: "2026-05-01", ultimoTacto: { fecha: "2026-07-01", resultado: "preñada", fechaProbableParto: "2027-02-08" } }), "2026-10-01"))
      .toEqual({ estado: "preñada", desde: "2026-07-01", fechaProbableParto: "2027-02-08" })
    expect(derivarEstado(h({ ultimoTacto: { fecha: "2026-07-01", resultado: "vacia", fechaProbableParto: null } }), "2026-10-01")).toMatchObject({ estado: "vacia" })
    // Servicio después de un tacto vacío: vuelve a servida
    expect(derivarEstado(h({ ultimoServicio: "2026-08-01", ultimoTacto: { fecha: "2026-07-01", resultado: "vacia", fechaProbableParto: null } }), "2026-10-01")).toMatchObject({ estado: "servida" })
  })
  it("parida 30 días, después en lactancia hasta el destete de la cría o los días de la especie", () => {
    const parto = (fecha: string, resultado = "vivo") => ({ ultimoParto: { fecha, resultado } })
    expect(derivarEstado(h(parto("2026-09-15")), "2026-10-01")).toMatchObject({ estado: "parida" })
    expect(derivarEstado(h(parto("2026-06-01")), "2026-10-01")).toMatchObject({ estado: "lactancia" })
    expect(derivarEstado(h({ ...parto("2026-06-01"), criaDestetada: true }), "2026-10-01")).toMatchObject({ estado: "vacia" })
    expect(derivarEstado(h(parto("2026-06-01")), "2026-10-01", "ovino")).toMatchObject({ estado: "vacia" })
    expect(derivarEstado(h(parto("2026-09-20", "aborto")), "2026-10-01")).toMatchObject({ estado: "vacia" })
  })
})

describe("servicio por torada", () => {
  const base = (extra: object = {}) => ({ clave: CLAVE, toradaId: TORADA, fecha: "2026-04-10", tipo: "natural", ...extra })
  it("sirve a todas las del grupo, omite preñadas y repetidas, en una operación", async () => {
    m.animales.mockResolvedValue([hembra(H1), hembra(H2), hembra(H3)])
    m.estados.mockResolvedValue(new Map([[H2, { estado: "preñada" }]]))
    m.serviciosDia.mockResolvedValue([{ hembraId: H3 }])
    const r = await servicioMasivo(operario, base())
    expect(r).toMatchObject({ cantidad: 1, omitidas: { prenadas: 1, yaServidas: 1 } })
    expect(m.crearMuchos).toHaveBeenCalledWith("servicio", [expect.objectContaining({ hembraId: H1, toradaId: TORADA, operacionId: CLAVE, fecha: new Date("2026-04-10T00:00:00Z") })])
    expect(m.audit).toHaveBeenCalledOnce()
  })
  it("un reintento con la misma clave no duplica; fuera de la torada o en ovinos con IA se rechaza", async () => {
    m.previos.mockResolvedValueOnce(3)
    await expect(servicioMasivo(operario, base())).resolves.toMatchObject({ repetido: true, cantidad: 3 })
    await expect(servicioMasivo(operario, base({ fecha: "2026-03-01" }))).rejects.toThrow(/fuera de la torada/)
    m.torada.mockResolvedValue({ ...(await m.torada()), tipoGrupo: "encarnerada", lote: { establecimientoId: EST, especieId: BOV, especie: { nombre: "ovino" } } })
    await expect(servicioMasivo(operario, base({ tipo: "ia", hembraIds: [H1] }))).rejects.toThrow(/solo natural/)
    expect(servicioMasivoSchema.safeParse(base({ tipo: "ia" })).success).toBe(false)
  })
  it("las hembras elegidas tienen que estar en el grupo ese día", async () => {
    m.animales.mockResolvedValue([hembra(H1)])
    await expect(servicioMasivo(operario, base({ tipo: "ia", hembraIds: [H1, H2] }))).rejects.toThrow(/1 de las hembras elegidas/)
  })
})

describe("planilla de tacto", () => {
  const base = (filas: object[], extra: object = {}) => ({ clave: CLAVE, fecha: "2026-07-01", filas, ...extra })
  it("vincula cada tacto a su servicio y calcula la fecha de parto; solo admin, encargado o vet", async () => {
    m.animales.mockResolvedValue([hembra(H1), hembra(H2)])
    m.servicios.mockResolvedValue([{ id: "S1", hembraId: H1, fecha: new Date("2026-04-10") }])
    await expect(tactoMasivo(operario, base([{ hembraId: H1, resultado: "preñada" }, { hembraId: H2, resultado: "vacia" }]))).rejects.toMatchObject({ status: 403 })
    const r = await tactoMasivo(vet, base([{ hembraId: H1, resultado: "preñada" }, { hembraId: H2, resultado: "vacia" }]))
    expect(r).toMatchObject({ cantidad: 2, prenadas: 1, vinculados: 1 })
    const filas = m.crearMuchos.mock.calls[0][1]
    // 10/4 + 283 días = 18/1/2027
    expect(filas[0]).toMatchObject({ hembraId: H1, servicioId: "S1", fechaProbableParto: new Date("2027-01-18T00:00:00Z"), operacionId: CLAVE })
    expect(filas[1]).toMatchObject({ hembraId: H2, servicioId: null, fechaProbableParto: null })
  })
  it("rechaza repetidas, machos y tactos ya cargados ese día", async () => {
    await expect(tactoMasivo(vet, base([{ hembraId: H1, resultado: "vacia" }, { hembraId: H1, resultado: "vacia" }]))).rejects.toThrow(/repetida/)
    m.animales.mockResolvedValue([hembra(H1, { sexo: "M" })])
    await expect(tactoMasivo(vet, base([{ hembraId: H1, resultado: "vacia" }]))).rejects.toThrow(/es macho/)
    m.animales.mockResolvedValue([hembra(H1)])
    m.tactosDia.mockResolvedValue([{ hembraId: H1 }])
    await expect(tactoMasivo(vet, base([{ hembraId: H1, resultado: "vacia" }]))).rejects.toMatchObject({ status: 409 })
  })
})

describe("destete por grupo", () => {
  it("crea destete, pesada y cambio de grupo por animal; avisa caravanas faltantes", async () => {
    m.animales.mockResolvedValue([hembra(H1, { sexo: "M", fechaNacimiento: new Date("2025-11-01") }), hembra(H2, { caravanaRfid: "982000000000001", fechaNacimiento: new Date("2025-11-11") })])
    m.lote.mockResolvedValue({ activo: true, especieId: BOV })
    m.histAbiertos.mockResolvedValue([{ id: "HX", loteId: LOTE, desde: new Date("2025-11-01T15:00:00Z") }])
    const r = await desteteMasivo(operario, { clave: CLAVE, fecha: "2026-05-01", loteDesteteId: uuid(30), filas: [{ animalId: H1, pesoKg: "185" }, { animalId: H2 }] })
    expect(r).toMatchObject({ cantidad: 2, movidos: 2, sinCaravana: 1 })
    const destetes = m.crear.mock.calls.filter((c) => c[0] === "destete").map((c) => c[1])
    expect(destetes[0]).toMatchObject({ animalId: H1, edadDias: 181, pesoKg: 185, operacionId: CLAVE })
    expect(m.crear.mock.calls.filter((c) => c[0] === "pesada")).toHaveLength(1)
    expect(m.histCrear).toHaveBeenCalledTimes(2)
  })
  it("no desteta dos veces ni a vet", async () => {
    m.animales.mockResolvedValue([hembra(H1)])
    await expect(desteteMasivo(vet, { clave: CLAVE, fecha: "2026-05-01", filas: [{ animalId: H1 }] })).rejects.toMatchObject({ status: 403 })
    m.destetados.mockResolvedValue([{ animalId: H1 }])
    await expect(desteteMasivo(operario, { clave: CLAVE, fecha: "2026-05-01", filas: [{ animalId: H1 }] })).rejects.toMatchObject({ status: 409 })
  })
})

describe("señalada", () => {
  const base = (extra: object = {}) => ({ loteId: LOTE, fecha: "2026-09-15", corderosSenalados: 80, corderosMuertos: 5, machosMantenidos: 2, machosCastrados: 38, hembras: 40, ...extra })
  it("es de un grupo ovino; el desglose suma el total; la clave hace idempotente el reintento", async () => {
    m.lote.mockResolvedValue({ establecimientoId: EST, activo: true, especie: { nombre: "ovino" } })
    m.crear.mockImplementation(async (_t: string, d: object) => d)
    await expect(registrarSenalada(operario, base())).resolves.toMatchObject({ corderosSenalados: 80, repetido: false })
    expect(senaladaSchema.safeParse(base({ hembras: 10 })).success).toBe(false)
    expect(senaladaSchema.safeParse(base({ machosMantenidos: 0, machosCastrados: 0, hembras: 0 })).success).toBe(true)
    await expect(registrarSenalada(vet, base())).rejects.toMatchObject({ status: 403 })
    m.lote.mockResolvedValue({ establecimientoId: EST, activo: true, especie: { nombre: "bovino" } })
    await expect(registrarSenalada(operario, base())).rejects.toThrow(/ovinos/)
    m.senaladaPrevia.mockResolvedValue({ id: "S0", corderosSenalados: 80 })
    await expect(registrarSenalada(operario, base({ clave: CLAVE }))).resolves.toMatchObject({ id: "S0", repetido: true })
  })
  it("califica el % señalada con la referencia patagónica", () => {
    expect([calificarSenalada(80), calificarSenalada(70), calificarSenalada(55)]).toEqual(["bueno", "regular", "malo"])
  })
})
