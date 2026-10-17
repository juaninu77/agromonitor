import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ animalFindMany: vi.fn(), loteFindMany: vi.fn(), productoFindMany: vi.fn(), crear: vi.fn(), contarDestino: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { animal: { findMany: m.animalFindMany }, lote: { findMany: m.loteFindMany }, producto: { findMany: m.productoFindMany } } }))
vi.mock("@/lib/sanidad/service", () => ({ contarDestino: m.contarDestino }))
vi.mock("@/lib/whatsapp/borradores", async (orig) => ({ ...(await orig<typeof import("@/lib/whatsapp/borradores")>()), crearBorrador: m.crear }))
import type { AuthContext } from "@/lib/api/with-auth"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { herramientasHacienda, type ContextoPropuesta } from "@/lib/whatsapp/herramientas/hacienda"

const EST = "00000000-0000-4000-8000-000000000001"
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const animal = (n: number, o: Record<string, unknown> = {}) => ({ id: uuid(100 + n), caravanaVisual: String(1200 + n), caravanaRfid: null, cuig: null, otroId: null, sexo: "F", especieId: "bov", ...o })

let c: ContextoPropuesta
const armar = (rol = "encargado") => {
  c = {
    ctx: { userId: "u1", establecimientoIds: [EST], rolPorEstablecimiento: { [EST]: rol } } as unknown as AuthContext,
    establecimientoId: EST, organizacionId: "o1", vinculoId: "v1", origen: "texto original", borradores: [],
  }
  return Object.fromEntries(herramientasHacienda(c).map((h) => [h.definicion.name, h]))
}
const correr = async (nombre: string, input: unknown, rol?: string) => JSON.parse(await armar(rol)[nombre].run(input as Record<string, unknown>))

beforeEach(() => {
  vi.resetAllMocks()
  m.crear.mockImplementation(async (d: { id: string; resumen: string }) => ({ id: d.id, resumen: d.resumen }))
  m.animalFindMany.mockResolvedValue([animal(1), animal(2)])
  m.loteFindMany.mockResolvedValue([{ id: uuid(50), nombre: "Terneros 2026", especieId: "bov" }, { id: uuid(51), nombre: "Vacas", especieId: "bov" }])
  m.productoFindMany.mockResolvedValue([{ id: uuid(60), nombre: "Ivomec 1%", tipo: "antiparasitario", unidad: "ml", organizacionId: "o1", retiroDias: 35 }])
  m.contarDestino.mockResolvedValue({ cantidad: 40, excede: false })
})

describe("proponer_sanidad", () => {
  it("a un grupo: resuelve producto y grupo, calcula el stock a descontar y crea el borrador", async () => {
    const r = await correr("proponer_sanidad", { producto: "ivomec", grupo: "terneros", dosis: 5, unidad: "ml", via: "subcutanea", motivo: "preventivo" })
    expect(r.ok).toBe(true)
    const d = m.crear.mock.calls[0][0]
    expect(d).toMatchObject({ accion: "sanidad", vinculoId: "v1", usuarioId: "u1", establecimientoId: EST, origen: "texto original" })
    expect(d.payload).toMatchObject({ clave: d.id, destino: { establecimientoId: EST, loteId: uuid(50) }, productoId: uuid(60), fecha: hoyArgentina(), descontarPorAnimal: 5, animalesEsperados: 40 })
    expect(d.resumen).toMatch(/Ivomec 1%[\s\S]*5 ml · Subcutánea · Preventivo[\s\S]*grupo «Terneros 2026» \(40 animales\)[\s\S]*35 días \(del producto\)[\s\S]*descuenta 200 ml/)
    expect(c.borradores).toHaveLength(1)
    // Los productos se buscan en la organización del campo o en el catálogo general
    expect(m.productoFindMany.mock.calls[0][0].where.OR).toEqual([{ organizacionId: "o1" }, { organizacionId: null }])
  })

  it("un producto del catálogo general no descuenta stock", async () => {
    m.productoFindMany.mockResolvedValue([{ id: uuid(61), nombre: "Aftosa", tipo: "vacuna", unidad: "dosis", organizacionId: null, retiroDias: 0 }])
    await correr("proponer_sanidad", { producto: "aftosa", caravanas: ["1201", "1202"] })
    const d = m.crear.mock.calls[0][0]
    expect(d.payload).toMatchObject({ destino: { animalIds: [uuid(101), uuid(102)] }, descontarPorAnimal: null })
    expect(d.resumen).toMatch(/catálogo general/)
  })

  it("un operario ve que va a validación", async () => {
    await correr("proponer_sanidad", { producto: "ivomec", grupo: "terneros" }, "operario")
    expect(m.crear.mock.calls[0][0].resumen).toMatch(/lo valide un encargado/)
  })

  it("un grupo ambiguo o inexistente vuelve como error con las opciones, sin crear nada", async () => {
    expect(await correr("proponer_sanidad", { producto: "ivomec", grupo: "s" })).toMatchObject({ error: expect.stringMatching(/varios grupos/), detalles: ["Grupo: Terneros 2026", "Grupo: Vacas"] })
    expect(await correr("proponer_sanidad", { producto: "ivomec", grupo: "toros" })).toMatchObject({ error: expect.stringMatching(/No hay un grupo/) })
    expect(m.crear).not.toHaveBeenCalled()
  })

  it("pide caravanas o grupo, no los dos", async () => {
    expect((await correr("proponer_sanidad", { producto: "ivomec" })).error).toMatch(/caravanas o el grupo/)
    expect((await correr("proponer_sanidad", { producto: "ivomec", grupo: "Vacas", caravanas: ["1"] })).error).toMatch(/caravanas o el grupo/)
  })
})

describe("resolver animales", () => {
  it("busca solo activos del campo activo y avisa los que no encuentra o son ambiguos", async () => {
    m.animalFindMany.mockResolvedValue([animal(1), animal(2, { caravanaVisual: "77" }), animal(3, { caravanaVisual: "77" })])
    const r = await correr("proponer_pesadas", { pesadas: [{ caravana: "1201", kg: 300 }, { caravana: "77", kg: 310 }, { caravana: "999", kg: 320 }] })
    expect(m.animalFindMany.mock.calls[0][0].where).toMatchObject({ establecimientoId: EST, estadoVital: "activo" })
    expect(r.detalles).toEqual(["77: coincide con 2 animales (decime la caravana electrónica)", "999: no está entre los animales activos del campo"])
    expect(m.crear).not.toHaveBeenCalled()
  })

  it("acepta el EID con espacios", async () => {
    m.animalFindMany.mockResolvedValue([animal(1, { caravanaVisual: null, caravanaRfid: "982000123456789" })])
    await correr("proponer_pesadas", { pesadas: [{ caravana: "982 000123456789", kg: 300 }] })
    expect(m.animalFindMany.mock.calls[0][0].where.OR).toContainEqual({ caravanaRfid: { in: ["982000123456789"] } })
    expect(m.crear.mock.calls[0][0].payload.pesadas[0]).toMatchObject({ animalId: uuid(101), peso: 300 })
  })

  it("un tacto rechaza machos", async () => {
    m.animalFindMany.mockResolvedValue([animal(1, { sexo: "M" })])
    expect((await correr("proponer_tactos", { resultados: [{ caravana: "1201", resultado: "preñada" }] })).detalles).toEqual(["1201: es macho"])
  })
})

describe("otras cargas", () => {
  it("tactos en una sola planilla idempotente", async () => {
    await correr("proponer_tactos", { resultados: [{ caravana: "1201", resultado: "preñada", meses: 3 }, { caravana: "1202", resultado: "vacia", meses: 2 }] })
    const d = m.crear.mock.calls[0][0]
    expect(d.payload).toMatchObject({ clave: d.id, metodo: "palpacion", filas: [{ hembraId: uuid(101), resultado: "preñada", mesesGest: 3 }, { hembraId: uuid(102), resultado: "vacia", mesesGest: null }] })
    expect(d.resumen).toMatch(/Tacto.*\(2, 1 preñadas\)[\s\S]*1201: Preñada \(3 meses\)[\s\S]*1202: Vacía/)
  })

  it("una baja necesita el motivo y no acepta fechas futuras", async () => {
    m.animalFindMany.mockResolvedValue([animal(1)])
    expect((await correr("proponer_baja", { caravana: "1201", motivo: "muerte", fecha: "2099-01-01" })).error).toMatch(/futura/)
    await correr("proponer_baja", { caravana: "1201", motivo: "muerte", observ: "empaste" })
    expect(m.crear.mock.calls[0][0]).toMatchObject({ accion: "baja", payload: { animalId: uuid(101), motivo: "muerte", observ: "empaste" } })
  })

  it("el cambio de grupo no mezcla especies", async () => {
    m.loteFindMany.mockResolvedValue([{ id: uuid(52), nombre: "Borregas", especieId: "ovi" }])
    expect((await correr("proponer_movimiento", { caravanas: ["1201"], grupo: "Borregas" })).error).toMatch(/otra especie/)
  })

  it("un parto sin crías ni aborto no pasa la validación", async () => {
    m.animalFindMany.mockResolvedValue([animal(1)])
    expect((await correr("proponer_parto", { caravana: "1201", crias: [] })).error).toMatch(/al menos una cría/)
    await correr("proponer_parto", { caravana: "1201", crias: [{ viva: true, sexo: "M", pesoKg: 32 }] })
    expect(m.crear.mock.calls[0][0].payload).toMatchObject({ madreId: uuid(101), aborto: false, crias: [{ resultado: "vivo", sexo: "M", pesoNacerKg: 32 }] })
  })

  it("no deja proponer más de 5 cargas en un mensaje", async () => {
    const h = armar()
    for (let i = 0; i < 5; i++) await h.proponer_celos.run({ caravanas: ["1201"], momento: "manana" })
    expect(JSON.parse(await h.proponer_celos.run({ caravanas: ["1201"], momento: "manana" })).error).toMatch(/varias cargas/)
    expect(m.crear).toHaveBeenCalledTimes(5)
  })
})
