import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), torada: vi.fn(), enLote: vi.fn(), ultimoTacto: vi.fn(), tactosDia: vi.fn(), partos: vi.fn(), serviciosDia: vi.fn(),
  servicio: vi.fn(), destetePrevio: vi.fn(), lote: vi.fn(), crear: vi.fn(), audit: vi.fn(), listar: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const crear = (tabla: string) => ({ create: (args: { data: object }) => m.crear(tabla, args) })
  const tx = {
    evtServicio: crear("servicio"), evtTacto: crear("tacto"), evtParicion: crear("paricion"), evtDestete: crear("destete"), torada: crear("torada"),
    auditLog: { create: m.audit },
  }
  return {
    prisma: {
      animal: { findFirst: m.animal },
      torada: { findFirst: m.torada },
      animalLoteHist: { count: m.enLote },
      evtTacto: { findFirst: m.ultimoTacto, count: m.tactosDia },
      evtParicion: { count: m.partos },
      evtServicio: { count: m.serviciosDia, findUnique: m.servicio, findMany: m.listar },
      evtDestete: { findUnique: m.destetePrevio },
      lote: { findFirst: m.lote },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { Prisma } from "@prisma/client"
import { crearTorada, errorReproduccion, listarServicios, registrarDestete, registrarParicion, registrarServicio, registrarTacto } from "@/lib/reproduccion/service"
import { tactoSchema, toradaSchema } from "@/lib/reproduccion/validation"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = uuid(1), OTRO = uuid(2), VACA = uuid(10), TORO = uuid(11), TORADA = uuid(12), LOTE = uuid(13), SERV = uuid(14), BOV = uuid(20), OVI = uuid(21)
const rol = (roles: string[]) => ({
  userId: "u1", establecimientoIds: [EST, OTRO], organizacionIds: ["o1"], organizacionDeEstablecimiento: { [EST]: "o1", [OTRO]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []),
}) as unknown as AuthContext
const operario = rol(["operario"]), vet = rol(["vet"]), encargado = rol(["encargado"])

const animal = (id: string, extra: object = {}) => ({ id, sexo: "F", estadoVital: "activo", especieId: BOV, establecimientoId: EST, fechaNacimiento: new Date("2020-01-01"), caravanaVisual: id === TORO ? "T-1" : "V-1", cuig: null, ...extra })
const animales = (lista: Record<string, object>) => m.animal.mockImplementation(async ({ where }: { where: { id: string } }) => (lista[where.id] ? animal(where.id, lista[where.id]) : null))

beforeEach(() => {
  vi.resetAllMocks()
  animales({ [VACA]: {}, [TORO]: { sexo: "M" } })
  m.crear.mockImplementation(async (_t: string, { data }: { data: object }) => ({ id: "E1", ...data }))
  m.enLote.mockResolvedValue(1)
  m.partos.mockResolvedValue(0)
  m.serviciosDia.mockResolvedValue(0)
  m.tactosDia.mockResolvedValue(0)
})

describe("servicio", () => {
  const base = (extra: object = {}) => ({ hembraId: VACA, fecha: "2026-03-10", tipo: "natural", ...extra })
  it("registra con auditoría; un operario puede (spec 10 §4)", async () => {
    await registrarServicio(operario, base({ machoId: TORO, observ: "" }))
    expect(m.crear).toHaveBeenCalledWith("servicio", { data: expect.objectContaining({ hembraId: VACA, machoId: TORO, fecha: new Date("2026-03-10T00:00:00Z"), observ: null }) })
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ tabla: "evt_servicio", organizacionId: "o1", accion: "INSERT" })
  })
  it("sin rol en el campo del animal responde 403", async () => {
    animales({ [VACA]: { establecimientoId: OTRO } })
    await expect(registrarServicio(operario, base())).rejects.toMatchObject({ status: 403 })
  })
  it("rechaza machos como hembra, hembras como macho, otra especie, bajas y fechas imposibles", async () => {
    animales({ [VACA]: { sexo: "M" } })
    await expect(registrarServicio(operario, base())).rejects.toThrow(/es macho/)
    animales({ [VACA]: {}, [TORO]: {} })
    await expect(registrarServicio(operario, base({ machoId: TORO }))).rejects.toThrow(/es hembra/)
    animales({ [VACA]: {}, [TORO]: { sexo: "M", especieId: OVI } })
    await expect(registrarServicio(operario, base({ machoId: TORO }))).rejects.toThrow(/otra especie/)
    animales({ [VACA]: { estadoVital: "vendido" } })
    await expect(registrarServicio(operario, base())).rejects.toThrow(/dado de baja/)
    animales({ [VACA]: { fechaNacimiento: new Date("2026-04-01") } })
    await expect(registrarServicio(operario, base())).rejects.toThrow(/anterior al nacimiento/)
    await expect(registrarServicio(operario, base({ fecha: "2999-01-01" }))).rejects.toThrow(/futura/)
    expect(m.crear).not.toHaveBeenCalled()
  })
  it("la torada: dentro de sus fechas y con la hembra en el grupo", async () => {
    m.torada.mockResolvedValue({ nombre: "Otoño", loteId: LOTE, fechaInicio: new Date("2026-04-01"), fechaFin: new Date("2026-06-30") })
    await expect(registrarServicio(operario, base({ toradaId: TORADA }))).rejects.toThrow(/fuera de la torada «Otoño» \(01\/04\/2026 al 30\/06\/2026\)/)
    m.enLote.mockResolvedValue(0)
    await expect(registrarServicio(operario, base({ toradaId: TORADA, fecha: "2026-04-10" }))).rejects.toThrow(/no estaba en el grupo/)
    expect(m.torada.mock.calls[0][0].where).toMatchObject({ id: TORADA, lote: { establecimientoId: EST } })
  })
  it("una hembra preñada sin parto posterior pide confirmar; un duplicado da 409", async () => {
    m.ultimoTacto.mockResolvedValue({ fecha: new Date("2026-01-05"), resultado: "preñada" })
    await expect(registrarServicio(operario, base())).rejects.toMatchObject({ status: 409, codigo: "prenada" })
    await expect(registrarServicio(operario, base({ aceptarPrenada: true }))).resolves.toBeTruthy()
    m.partos.mockResolvedValue(1)
    await expect(registrarServicio(operario, base())).resolves.toBeTruthy()
    m.serviciosDia.mockResolvedValue(1)
    await expect(registrarServicio(operario, base())).rejects.toMatchObject({ status: 409 })
  })
})

describe("tacto", () => {
  const base = (extra: object = {}) => ({ hembraId: VACA, fecha: "2026-05-10", resultado: "preñada", ...extra })
  it("solo admin, encargado o vet", async () => {
    await expect(registrarTacto(operario, base())).rejects.toMatchObject({ status: 403 })
    await expect(registrarTacto(vet, base({ mesesGest: "2,5", fechaProbableParto: "2026-12-01" }))).resolves.toBeTruthy()
    expect(m.crear.mock.calls[0][1].data).toMatchObject({ mesesGest: 2.5, fechaProbableParto: new Date("2026-12-01T00:00:00Z"), metodo: "palpacion" })
  })
  it("el servicio tiene que ser de la misma hembra, anterior y sin tacto", async () => {
    m.servicio.mockResolvedValue({ hembraId: uuid(99), fecha: new Date("2026-03-01"), tacto: null })
    await expect(registrarTacto(vet, base({ servicioId: SERV }))).rejects.toThrow(/no es de V-1/)
    m.servicio.mockResolvedValue({ hembraId: VACA, fecha: new Date("2026-06-01"), tacto: null })
    await expect(registrarTacto(vet, base({ servicioId: SERV }))).rejects.toThrow(/anterior a su servicio/)
    m.servicio.mockResolvedValue({ hembraId: VACA, fecha: new Date("2026-03-01"), tacto: { id: "T0" } })
    await expect(registrarTacto(vet, base({ servicioId: SERV }))).rejects.toMatchObject({ status: 409 })
  })
  it("valida resultado, meses y fecha de parto", () => {
    expect(tactoSchema.safeParse(base({ resultado: "cualquiera" })).success).toBe(false)
    expect(tactoSchema.safeParse(base({ resultado: "vacia", mesesGest: 3 })).success).toBe(false)
    expect(tactoSchema.safeParse(base({ fechaProbableParto: "2026-05-01" })).success).toBe(false)
    expect(tactoSchema.safeParse(base({ mesesGest: 12 })).success).toBe(false)
  })
})

describe("parición", () => {
  const base = (extra: object = {}) => ({ madreId: VACA, fecha: "2026-09-01", resultado: "vivo", ...extra })
  it("un segundo parto el mismo día pide confirmar mellizo", async () => {
    m.partos.mockResolvedValue(1)
    await expect(registrarParicion(operario, base())).rejects.toMatchObject({ status: 409, codigo: "mellizo" })
    await expect(registrarParicion(operario, base({ confirmarMellizo: true }))).resolves.toBeTruthy()
  })
  it("el padre: macho de la especie, aunque ya no esté activo; no ambos padres", async () => {
    animales({ [VACA]: {}, [TORO]: { sexo: "M", estadoVital: "vendido" } })
    await expect(registrarParicion(operario, base({ padreId: TORO, tipoParto: "", sexoCria: "M" }))).resolves.toBeTruthy()
    expect(m.crear.mock.calls[0][1].data).toMatchObject({ padreId: TORO, tipoParto: null, sexoCria: "M" })
    await expect(registrarParicion(operario, base({ padreId: TORO, padreExterno: "Toro IA" }))).rejects.toThrow(/no ambos/)
  })
})

describe("destete", () => {
  it("una vez por animal, edad calculada del nacimiento y grupo del mismo campo", async () => {
    await expect(registrarDestete(vet, { animalId: VACA, fecha: "2026-05-01" })).rejects.toMatchObject({ status: 403 })
    animales({ [VACA]: { fechaNacimiento: new Date("2025-11-02") } })
    await registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01", pesoKg: "180", edadDias: "1" })
    expect(m.crear.mock.calls[0][1].data).toMatchObject({ edadDias: 180, pesoKg: 180 })
    m.lote.mockResolvedValue(null)
    await expect(registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01", loteDesteteId: LOTE })).rejects.toThrow(/no es del campo/)
    m.destetePrevio.mockResolvedValue({ fecha: new Date("2026-04-01") })
    await expect(registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01" })).rejects.toMatchObject({ status: 409 })
  })
})

describe("torada", () => {
  it("la crean admin o encargado del campo del grupo, con fechas coherentes", async () => {
    m.lote.mockResolvedValue({ establecimientoId: EST, activo: true })
    const t = { nombre: "Otoño 2026", loteId: LOTE, fechaInicio: "2026-04-01", tipo: "natural" }
    await expect(crearTorada(vet, t)).rejects.toMatchObject({ status: 403 })
    await expect(crearTorada(encargado, t)).resolves.toMatchObject({ nombre: "Otoño 2026" })
    expect(toradaSchema.safeParse({ ...t, fechaFin: "2026-03-01" }).success).toBe(false)
  })
})

describe("listados y errores", () => {
  it("siempre por un campo propio y con límite", async () => {
    await expect(listarServicios(operario, { establecimientoId: uuid(77) })).rejects.toMatchObject({ status: 404 })
    await expect(listarServicios(operario, { establecimientoId: EST, limit: "500" })).rejects.toThrow()
    m.listar.mockResolvedValue([])
    const r = await listarServicios(operario, { establecimientoId: EST, sinTacto: "true", q: "V-1" })
    expect(m.listar.mock.calls[0][0].where).toMatchObject({ hembra: { establecimientoId: EST }, tacto: { is: null } })
    expect(r.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 })
  })
  it("un duplicado de la base es 409, no 500", () => {
    const e = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })
    expect(errorReproduccion(e)?.status).toBe(409)
    expect(errorReproduccion(new Error("x"))).toBeNull()
  })
})
