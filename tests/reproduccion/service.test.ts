import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), torada: vi.fn(), enLote: vi.fn(), ultimoTacto: vi.fn(), tactosDia: vi.fn(), partos: vi.fn(), serviciosDia: vi.fn(),
  servicio: vi.fn(), destetePrevio: vi.fn(), lote: vi.fn(), crear: vi.fn(), audit: vi.fn(), listar: vi.fn(),
  loteMadre: vi.fn(), lugarMadre: vi.fn(), categorias: vi.fn(), usados: vi.fn(), histAbiertos: vi.fn(), histCerrar: vi.fn(), histCrear: vi.fn(),
  anular: vi.fn(), eventoServicio: vi.fn(), eventoTacto: vi.fn(), eventoParto: vi.fn(), partosDe: vi.fn(), toradaEdit: vi.fn(), ultimoServicio: vi.fn(),
  machos: vi.fn(), machosBorrar: vi.fn(), machosCrear: vi.fn(), toradaUpdate: vi.fn(),
}))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: async () => ({ creadas: 0, cumplidas: 0 }) }))
vi.mock("@/lib/prisma", () => {
  const crear = (tabla: string) => ({ create: (args: { data: object }) => m.crear(tabla, args) })
  const anular = (tabla: string) => ({ updateMany: (args: object) => m.anular(tabla, args) })
  const tx = {
    evtServicio: { ...crear("servicio"), ...anular("servicio") }, evtTacto: { ...crear("tacto"), ...anular("tacto") },
    evtParicion: { ...crear("paricion"), ...anular("paricion") }, evtDestete: { ...crear("destete"), ...anular("destete") },
    torada: { ...crear("torada"), update: m.toradaUpdate, findUniqueOrThrow: async () => ({ id: "T" }) },
    toradaMacho: { deleteMany: m.machosBorrar, createMany: m.machosCrear },
    animal: crear("animal"), genealogia: crear("genealogia"), evtPesada: crear("pesada"), ubicacionHist: crear("ubicacion"),
    animalLoteHist: { create: m.histCrear, findMany: m.histAbiertos, updateMany: m.histCerrar },
    auditLog: { create: m.audit },
  }
  return {
    prisma: {
      animal: { findFirst: m.animal, findMany: m.usados },
      torada: { findFirst: m.torada },
      animalLoteHist: { count: m.enLote, findFirst: m.loteMadre },
      ubicacionHist: { findFirst: m.lugarMadre },
      categoria: { findMany: m.categorias },
      evtTacto: { findFirst: async (a: { where: { id?: string } }) => (a.where.id ? m.eventoTacto(a) : m.ultimoTacto(a)), count: m.tactosDia },
      evtParicion: { count: m.partos, findFirst: m.eventoParto, findMany: m.partosDe },
      evtServicio: { count: m.serviciosDia, findUnique: m.servicio, findMany: m.listar, findFirst: async (a: { where: { id?: string } }) => (a.where.id ? m.eventoServicio(a) : m.ultimoServicio(a)) },
      evtDestete: { findFirst: m.destetePrevio },
      lote: { findFirst: m.lote },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { Prisma } from "@prisma/client"
import { anularEvento, crearTorada, editarTorada, errorReproduccion, listarServicios, registrarDestete, registrarParicion, registrarServicio, registrarTacto } from "@/lib/reproduccion/service"
import { calcularParto, tactoSchema, toradaSchema } from "@/lib/reproduccion/validation"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = uuid(1), OTRO = uuid(2), VACA = uuid(10), TORO = uuid(11), TORADA = uuid(12), LOTE = uuid(13), SERV = uuid(14), BOV = uuid(20), OVI = uuid(21)
const rol = (roles: string[]) => ({
  userId: "u1", establecimientoIds: [EST, OTRO], organizacionIds: ["o1"], organizacionDeEstablecimiento: { [EST]: "o1", [OTRO]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []),
}) as unknown as AuthContext
const operario = rol(["operario"]), vet = rol(["vet"]), encargado = rol(["encargado"])

const animal = (id: string, extra: object = {}) => ({
  id, sexo: "F", estadoVital: "activo", especieId: BOV, razaId: "R1", establecimientoId: EST, fechaNacimiento: new Date("2020-01-01"),
  caravanaVisual: id === TORO ? "T-1" : "V-1", cuig: null, caravanaRfid: null, especie: { nombre: "bovino" }, ...extra,
})
const animales = (lista: Record<string, object>) => m.animal.mockImplementation(async ({ where }: { where: { id: string } }) => (lista[where.id] ? animal(where.id, lista[where.id]) : null))

beforeEach(() => {
  vi.resetAllMocks()
  animales({ [VACA]: {}, [TORO]: { sexo: "M" } })
  m.crear.mockImplementation(async (_t: string, { data }: { data: object }) => ({ id: "E1", ...data }))
  m.enLote.mockResolvedValue(1)
  m.partos.mockResolvedValue(0)
  m.serviciosDia.mockResolvedValue(0)
  m.tactosDia.mockResolvedValue(0)
  m.usados.mockResolvedValue([])
  m.categorias.mockResolvedValue([])
  m.histAbiertos.mockResolvedValue([])
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
  it("calcula la fecha probable de parto del servicio o de los meses (spec 03 §3.7)", async () => {
    m.servicio.mockResolvedValue({ hembraId: VACA, fecha: new Date("2026-03-01"), anuladoAt: null, tacto: null })
    await registrarTacto(vet, base({ servicioId: SERV }))
    // 1/3 + 283 días = 9/12; meses desde el servicio: 70 días / 30
    expect(m.crear.mock.calls[0][1].data).toMatchObject({ fechaProbableParto: new Date("2026-12-09T00:00:00Z"), mesesGest: 2.3, servicioId: SERV })
    // Ecografía sin meses ni servicio: se exigen los meses
    await expect(registrarTacto(vet, base({ metodo: "ecografia" }))).rejects.toThrow(/meses de gestación/)
    // Ovino: 150 días − 2 meses = 90 días
    expect(calcularParto("ovino", "2026-05-10", { mesesGest: 2 })).toEqual({ fecha: "2026-08-08", mesesGest: 2 })
    expect(calcularParto("bovino", "2026-05-10", {})).toEqual({ fecha: null, mesesGest: null })
  })
  it("el servicio tiene que ser de la misma hembra, anterior y sin tacto", async () => {
    m.servicio.mockResolvedValue({ hembraId: uuid(99), fecha: new Date("2026-03-01"), anuladoAt: null, tacto: null })
    await expect(registrarTacto(vet, base({ servicioId: SERV }))).rejects.toThrow(/no es de V-1/)
    m.servicio.mockResolvedValue({ hembraId: VACA, fecha: new Date("2026-06-01"), anuladoAt: null, tacto: null })
    await expect(registrarTacto(vet, base({ servicioId: SERV }))).rejects.toThrow(/anterior a su servicio/)
    m.servicio.mockResolvedValue({ hembraId: VACA, fecha: new Date("2026-03-01"), anuladoAt: null, tacto: { id: "T0" } })
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
  const base = (extra: object = {}) => ({ madreId: VACA, fecha: "2026-09-01", crias: [{ resultado: "vivo", sexo: "M", pesoNacerKg: "32", caravanaVisual: "C-1" }], ...extra })
  it("da de alta la cría viva con genealogía, grupo y lugar de la madre, y su peso al nacer (spec 03 §3.8)", async () => {
    m.loteMadre.mockResolvedValue({ loteId: LOTE })
    m.lugarMadre.mockResolvedValue({ sectorId: "S1" })
    // Como en el catálogo real: ternero/a sin edad mínima (desde el nacimiento)
    m.categorias.mockResolvedValue([
      { id: "novillito", sexo: "M", edadMinMeses: 12, edadMaxMeses: 24, organizacionId: "o1" }, { id: "vaca", sexo: "F", edadMinMeses: 36, edadMaxMeses: null, organizacionId: "o1" },
      { id: "ternero", sexo: "M", edadMinMeses: null, edadMaxMeses: 12, organizacionId: "o1" }, { id: "ternera", sexo: "F", edadMinMeses: null, edadMaxMeses: 12, organizacionId: "o1" },
    ])
    const r = await registrarParicion(operario, base({ padreExterno: "Toro IA" }))
    const alta = m.crear.mock.calls.find((c) => c[0] === "animal")![1].data
    expect(alta).toMatchObject({ especieId: BOV, razaId: "R1", categoriaId: "ternero", sexo: "M", origen: "cria_propia", establecimientoId: EST, caravanaVisual: "C-1", fechaNacimiento: new Date("2026-09-01T00:00:00Z") })
    expect(m.crear.mock.calls.find((c) => c[0] === "genealogia")![1].data).toMatchObject({ animalId: alta.id, madreId: VACA, padreId: null, padreExterno: "Toro IA" })
    expect(m.histCrear.mock.calls[0][0].data).toMatchObject({ animalId: alta.id, loteId: LOTE, motivo: "nacimiento" })
    expect(m.crear.mock.calls.find((c) => c[0] === "ubicacion")![1].data).toMatchObject({ sectorId: "S1" })
    expect(m.crear.mock.calls.find((c) => c[0] === "pesada")![1].data).toMatchObject({ animalId: alta.id, pesoKg: 32 })
    expect(m.crear.mock.calls.find((c) => c[0] === "paricion")![1].data).toMatchObject({ resultado: "vivo", nacidoAnimalId: alta.id, partoId: r.partoId, sexoCria: "M" })
  })
  it("mellizos comparten el parto; una muerta no se da de alta; el aborto no lleva crías", async () => {
    await registrarParicion(operario, base({ crias: [{ resultado: "vivo", sexo: "F" }, { resultado: "muerto" }] }))
    const partos = m.crear.mock.calls.filter((c) => c[0] === "paricion").map((c) => c[1].data)
    expect(partos).toHaveLength(2)
    expect(partos[0].partoId).toBe(partos[1].partoId)
    expect(partos[1]).toMatchObject({ resultado: "muerto", nacidoAnimalId: null })
    expect(m.crear.mock.calls.filter((c) => c[0] === "animal")).toHaveLength(1)
    m.crear.mockClear()
    await registrarParicion(operario, base({ aborto: true, crias: [] }))
    expect(m.crear.mock.calls.map((c) => c[0])).toEqual(["paricion"])
    await expect(registrarParicion(operario, base({ crias: [] }))).rejects.toThrow(/al menos una cría/)
    await expect(registrarParicion(operario, base({ crias: [{ resultado: "vivo" }] }))).rejects.toThrow(/sexo de la cría/)
  })
  it("caravana usada o EID inválido; un segundo parto el mismo día pide confirmar", async () => {
    m.usados.mockResolvedValueOnce([{ caravanaVisual: "C-1" }]).mockResolvedValueOnce([])
    await expect(registrarParicion(operario, base())).rejects.toThrow(/C-1 ya está usada/)
    await expect(registrarParicion(operario, base({ crias: [{ resultado: "vivo", sexo: "M", caravanaRfid: "12" }] }))).rejects.toThrow(/EID/)
    m.partos.mockResolvedValue(1)
    await expect(registrarParicion(operario, base())).rejects.toMatchObject({ status: 409, codigo: "mellizo" })
    await expect(registrarParicion(operario, base({ confirmarMellizo: true }))).resolves.toBeTruthy()
  })
  it("el padre: macho de la especie, aunque ya no esté activo; no ambos padres", async () => {
    animales({ [VACA]: {}, [TORO]: { sexo: "M", estadoVital: "vendido", razaId: "R2" } })
    await expect(registrarParicion(operario, base({ padreId: TORO }))).resolves.toBeTruthy()
    // Cruza: sin raza
    expect(m.crear.mock.calls.find((c) => c[0] === "animal")![1].data.razaId).toBeNull()
    await expect(registrarParicion(operario, base({ padreId: TORO, padreExterno: "Toro IA" }))).rejects.toThrow(/no ambos/)
  })
})

describe("destete", () => {
  it("una vez por animal, edad calculada del nacimiento y grupo del mismo campo", async () => {
    await expect(registrarDestete(vet, { animalId: VACA, fecha: "2026-05-01" })).rejects.toMatchObject({ status: 403 })
    animales({ [VACA]: { fechaNacimiento: new Date("2025-11-02") } })
    const r = await registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01", pesoKg: "180", edadDias: "1" })
    expect(m.crear.mock.calls.find((c) => c[0] === "destete")![1].data).toMatchObject({ edadDias: 180, pesoKg: 180 })
    // La pesada del destete y el aviso de caravana electrónica (bovino sin EID)
    expect(m.crear.mock.calls.find((c) => c[0] === "pesada")![1].data).toMatchObject({ animalId: VACA, pesoKg: 180 })
    expect(r.aviso).toMatch(/caravana electrónica/)
    // Pasa al grupo de destete: cierra el actual y abre el nuevo
    m.lote.mockResolvedValue({ activo: true, especieId: BOV })
    m.histAbiertos.mockResolvedValue([{ id: "H1", loteId: uuid(40), desde: new Date("2025-11-02T15:00:00Z") }])
    await registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01", loteDesteteId: LOTE })
    expect(m.histCerrar.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["H1"] } } })
    expect(m.histCrear.mock.calls[0][0].data).toMatchObject({ animalId: VACA, loteId: LOTE, motivo: "destete" })
    m.lote.mockResolvedValue(null)
    await expect(registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01", loteDesteteId: LOTE })).rejects.toThrow(/no es del campo/)
    m.destetePrevio.mockResolvedValue({ fecha: new Date("2026-04-01") })
    await expect(registrarDestete(operario, { animalId: VACA, fecha: "2026-05-01" })).rejects.toMatchObject({ status: 409 })
  })
})

describe("torada", () => {
  it("la crean admin o encargado del campo del grupo, con fechas coherentes", async () => {
    m.lote.mockResolvedValue({ establecimientoId: EST, activo: true, especie: { nombre: "bovino" } })
    const t = { nombre: "Otoño 2026", loteId: LOTE, fechaInicio: "2026-04-01", tipo: "natural" }
    await expect(crearTorada(vet, t)).rejects.toMatchObject({ status: 403 })
    await expect(crearTorada(encargado, t)).resolves.toMatchObject({ nombre: "Otoño 2026" })
    expect(toradaSchema.safeParse({ ...t, fechaFin: "2026-03-01" }).success).toBe(false)
  })
})

describe("anular y torada", () => {
  it("solo admin/encargado; un servicio con tacto vigente no se anula; el tacto libera su servicio", async () => {
    m.eventoServicio.mockResolvedValue({ id: SERV, fecha: new Date("2026-03-01"), anuladoAt: null, hembra: { establecimientoId: EST }, tacto: { fecha: new Date("2026-05-01"), anuladoAt: null } })
    await expect(anularEvento(vet, "servicio", SERV, { motivo: "error" })).rejects.toMatchObject({ status: 403 })
    await expect(anularEvento(encargado, "servicio", SERV, { motivo: "error" })).rejects.toThrow(/anulá primero el tacto/)
    await expect(anularEvento(encargado, "servicio", SERV, { motivo: "x" })).rejects.toThrow(/por qué/)
    m.eventoTacto.mockResolvedValue({ id: "T1", fecha: new Date("2026-05-01"), anuladoAt: null, servicioId: SERV, hembra: { establecimientoId: EST } })
    await anularEvento(encargado, "tacto", "T1", { motivo: "vaca equivocada" })
    expect(m.anular).toHaveBeenCalledWith("tacto", { where: { id: { in: ["T1"] } }, data: expect.objectContaining({ servicioId: null, motivoAnulacion: "vaca equivocada", anuladoPorId: "u1" }) })
    m.eventoTacto.mockResolvedValue({ id: "T1", fecha: new Date("2026-05-01"), anuladoAt: new Date(), servicioId: null, hembra: { establecimientoId: EST } })
    await expect(anularEvento(encargado, "tacto", "T1", { motivo: "otra vez" })).rejects.toMatchObject({ status: 409 })
  })
  it("un parto se anula entero y, con crías dadas de alta, pide confirmar", async () => {
    m.eventoParto.mockResolvedValue({ id: "P1", fecha: new Date("2026-09-01"), anuladoAt: null, partoId: "PX", madre: { establecimientoId: EST } })
    m.partosDe.mockResolvedValue([{ id: "P1", nacido: { caravanaVisual: "C-1", cuig: null } }, { id: "P2", nacido: null }])
    await expect(anularEvento(encargado, "paricion", "P1", { motivo: "error de carga" })).rejects.toMatchObject({ status: 409, codigo: "paricion_con_cria" })
    await expect(anularEvento(encargado, "paricion", "P1", { motivo: "error de carga", aceptarCria: true })).resolves.toMatchObject({ anulados: 2 })
    expect(m.anular).toHaveBeenCalledWith("paricion", expect.objectContaining({ where: { id: { in: ["P1", "P2"] } } }))
  })
  it("cerrar una torada: no antes de su último servicio; los toros son machos de la especie del grupo", async () => {
    m.torada.mockResolvedValue({ id: TORADA, fechaInicio: new Date("2026-04-01"), lote: { establecimientoId: EST, especieId: BOV } })
    m.ultimoServicio.mockResolvedValue({ fecha: new Date("2026-06-10") })
    await expect(editarTorada(encargado, TORADA, { fechaFin: "2026-06-01" })).rejects.toThrow(/servicios hasta el 10\/06\/2026/)
    await expect(editarTorada(vet, TORADA, { fechaFin: "2026-06-30" })).rejects.toMatchObject({ status: 403 })
    m.usados.mockResolvedValue([animal(TORO, { sexo: "M", especieId: OVI })])
    await expect(editarTorada(encargado, TORADA, { machoIds: [TORO] })).rejects.toThrow(/otra especie/)
    m.usados.mockResolvedValue([animal(TORO, { sexo: "M" })])
    await editarTorada(encargado, TORADA, { fechaFin: "2026-06-30", machoIds: [TORO] })
    expect(m.toradaUpdate.mock.calls[0][0].data).toEqual({ fechaFin: new Date("2026-06-30T00:00:00Z") })
    expect(m.machosCrear.mock.calls[0][0].data).toEqual([{ toradaId: TORADA, animalId: TORO }])
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
