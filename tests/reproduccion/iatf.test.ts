import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  torada: vi.fn(), hembras: vi.fn(), enOtro: vi.fn(), estados: vi.fn(), crearP: vi.fn(), crearH: vi.fn(), crearT: vi.fn(), audit: vi.fn(),
  protocolo: vi.fn(), activas: vi.fn(), aplicar: vi.fn(), servicio: vi.fn(), actualizarP: vi.fn(), tareaUpd: vi.fn(), sanidadUpd: vi.fn(),
}))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: async () => ({}) }))
vi.mock("@/lib/reproduccion/estado", () => ({ estadosReproductivos: m.estados }))
vi.mock("@/lib/sanidad/service", () => ({ aplicarMasivo: m.aplicar }))
vi.mock("@/lib/reproduccion/grupos", () => ({ servicioMasivo: m.servicio }))
vi.mock("@/lib/prisma", () => {
  const tx = { protocoloIatf: { create: m.crearP }, protocoloIatfHembra: { createMany: m.crearH }, tarea: { createMany: m.crearT }, auditLog: { create: m.audit } }
  return {
    prisma: {
      torada: { findFirst: m.torada },
      animal: { findMany: async (a: { where: { estadoVital?: string; sexo?: string } }) => (a.where.sexo ? m.hembras(a) : m.activas(a)) },
      protocoloIatfHembra: { findMany: m.enOtro },
      protocoloIatf: { findFirst: m.protocolo, update: m.actualizarP },
      tarea: { update: m.tareaUpd },
      evtSanidad: { updateMany: m.sanidadUpd },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { claveDerivada, crearProtocoloIatf, registrarPasoIatf } from "@/lib/reproduccion/iatf"
import type { AuthContext } from "@/lib/api/with-auth"

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = u(1), TOR = u(2), H1 = u(3), H2 = u(4), PROD = u(5), CLAVE = u(6)
const ctx = (roles: string[]) => ({ userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" }, establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []) }) as unknown as AuthContext
const vet = ctx(["vet"]), operario = ctx(["operario"])
const hembra = (id: string, extra: object = {}) => ({ id, sexo: "F", estadoVital: "activo", especieId: "B", establecimientoId: EST, fechaNacimiento: new Date("2022-01-01"), caravanaVisual: id.slice(-2), cuig: null, caravanaRfid: null, especie: { nombre: "bovino" }, ...extra })
const base = { toradaId: TOR, plantilla: "convencional_8", fechaD0: "2026-10-01", hembraIds: [H1, H2] }

beforeEach(() => {
  vi.resetAllMocks()
  m.torada.mockResolvedValue({ id: TOR, nombre: "IATF otoño", tipo: "iatf", fechaFin: null, loteId: "L1", lote: { establecimientoId: EST, especieId: "B", especie: { nombre: "bovino" } } })
  m.hembras.mockResolvedValue([hembra(H1), hembra(H2)])
  m.enOtro.mockResolvedValue([])
  m.estados.mockResolvedValue(new Map())
  m.crearP.mockImplementation(async ({ data }: { data: object }) => ({ id: "P1", ...data }))
})

describe("clave derivada", () => {
  it("es un UUID válido y estable por sufijo", () => {
    expect(claveDerivada(CLAVE, "t0")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(claveDerivada(CLAVE, "t0")).toBe(claveDerivada(CLAVE, "t0"))
    expect(claveDerivada(CLAVE, "t0")).not.toBe(claveDerivada(CLAVE, "ia"))
  })
})

describe("armar un protocolo IATF", () => {
  it("crea el protocolo, sus hembras y una tarea por paso con su fecha", async () => {
    const r = await crearProtocoloIatf(vet, base)
    expect(r).toMatchObject({ hembras: 2, pasos: 3, inseminacion: "2026-10-11" })
    const tareas = m.crearT.mock.calls[0][0].data
    expect(tareas.map((t: { tipo: string; pasoIatf: number }) => [t.tipo, t.pasoIatf])).toEqual([["sanitario", 0], ["sanitario", 1], ["reproduccion", 2]])
    expect(tareas[1].fechaLimite.toISOString()).toBe("2026-10-09T15:00:00.000Z")
    expect(m.crearH.mock.calls[0][0].data).toHaveLength(2)
  })
  it("rechaza: operario, monta natural, ovinos, terneras, hembras en otro protocolo; pide confirmar preñadas", async () => {
    await expect(crearProtocoloIatf(operario, base)).rejects.toMatchObject({ status: 403 })
    m.torada.mockResolvedValueOnce({ id: TOR, nombre: "Natural", tipo: "natural", fechaFin: null, loteId: "L1", lote: { establecimientoId: EST, especieId: "B", especie: { nombre: "bovino" } } })
    await expect(crearProtocoloIatf(vet, base)).rejects.toThrow(/monta natural/)
    m.torada.mockResolvedValueOnce({ id: TOR, nombre: "Encarnerada", tipo: "iatf", fechaFin: null, loteId: "L1", lote: { establecimientoId: EST, especieId: "O", especie: { nombre: "ovino" } } })
    await expect(crearProtocoloIatf(vet, base)).rejects.toThrow(/ovinos/)
    m.hembras.mockResolvedValueOnce([hembra(H1), hembra(H2, { fechaNacimiento: new Date("2026-03-01") })])
    await expect(crearProtocoloIatf(vet, base)).rejects.toThrow(/menos de 10 meses/)
    m.enOtro.mockResolvedValueOnce([{ animalId: H1, protocolo: { nombre: "Otro" } }])
    await expect(crearProtocoloIatf(vet, base)).rejects.toMatchObject({ status: 409 })
    m.estados.mockResolvedValueOnce(new Map([[H2, { estado: "preñada" }]]))
    await expect(crearProtocoloIatf(vet, base)).rejects.toMatchObject({ status: 409, codigo: "prenadas" })
    expect(m.crearP).not.toHaveBeenCalled()
  })
})

describe("registrar un paso", () => {
  const protocolo = (extra: object = {}) => ({
    id: "P1", nombre: "IATF otoño", plantilla: "convencional_8", estado: "activo", fechaD0: new Date("2026-10-01"), establecimientoId: EST, toradaId: TOR, inseminador: "Dr. A", operacionServicioId: null,
    hembras: [{ animalId: H1 }, { animalId: H2 }], torada: { id: TOR, nombre: "IATF otoño" },
    tareas: [{ id: "T0", pasoIatf: 0, estado: "pendiente", tipo: "sanitario" }, { id: "T1", pasoIatf: 1, estado: "pendiente", tipo: "sanitario" }, { id: "T2", pasoIatf: 2, estado: "pendiente", tipo: "reproduccion" }],
    ...extra,
  })
  beforeEach(() => {
    m.protocolo.mockResolvedValue(protocolo())
    m.activas.mockResolvedValue([{ id: H1 }, { id: H2 }])
    m.aplicar.mockResolvedValue({ cantidad: 2 })
    m.servicio.mockResolvedValue({ cantidad: 2, pajuelas: 2 })
  })
  it("los tratamientos van a Sanidad a esas hembras, con clave derivada, y la tarea queda cumplida y vinculada", async () => {
    const r = await registrarPasoIatf(vet, "P1", 0, { clave: CLAVE, fecha: "2026-10-01", tratamientos: [{ indice: 1, productoId: PROD, dosis: 2, descontarPorAnimal: 2 }] })
    expect(m.aplicar).toHaveBeenCalledOnce()
    expect(m.aplicar.mock.calls[0][1]).toMatchObject({ clave: claveDerivada(CLAVE, "t1"), destino: { establecimientoId: EST, animalIds: [H1, H2] }, productoId: PROD, dosis: 2, via: "intramuscular", descontarPorAnimal: 2, animalesEsperados: 2 })
    expect(m.sanidadUpd).toHaveBeenCalledWith({ where: { operacionId: { in: [claveDerivada(CLAVE, "t1")] } }, data: { tareaId: "T0" } })
    expect(m.tareaUpd).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "T0" } }))
    expect(r).toMatchObject({ hembras: 2, aplicaciones: 1, servicios: 0 })
  })
  it("la inseminación registra el servicio IATF por grupo y cierra el protocolo", async () => {
    await registrarPasoIatf(vet, "P1", 2, { clave: CLAVE, fecha: "2026-10-11", productoSemenId: PROD })
    expect(m.servicio.mock.calls[0][1]).toMatchObject({ clave: claveDerivada(CLAVE, "ia"), toradaId: TOR, tipo: "iatf", hembraIds: [H1, H2], inseminador: "Dr. A", productoSemenId: PROD })
    expect(m.actualizarP).toHaveBeenCalledWith({ where: { id: "P1" }, data: expect.objectContaining({ estado: "cerrado", operacionServicioId: claveDerivada(CLAVE, "ia") }) })
  })
  it("no repite un paso hecho, no acepta tratamientos que no son del paso ni fechas anteriores al día 0", async () => {
    m.protocolo.mockResolvedValueOnce(protocolo({ tareas: [{ id: "T0", pasoIatf: 0, estado: "completada", tipo: "sanitario" }] }))
    await expect(registrarPasoIatf(vet, "P1", 0, { clave: CLAVE, fecha: "2026-10-01" })).rejects.toMatchObject({ status: 409 })
    await expect(registrarPasoIatf(vet, "P1", 0, { clave: CLAVE, fecha: "2026-10-01", tratamientos: [{ indice: 5, productoId: PROD }] })).rejects.toThrow(/no corresponden/)
    await expect(registrarPasoIatf(vet, "P1", 0, { clave: CLAVE, fecha: "2026-09-20" })).rejects.toThrow(/anterior al día 0/)
    await expect(registrarPasoIatf(vet, "P1", 0, { clave: CLAVE, fecha: "2026-10-01", hembraIds: [u(99)] })).rejects.toThrow(/no son del protocolo/)
    expect(m.aplicar).not.toHaveBeenCalled()
  })
})
