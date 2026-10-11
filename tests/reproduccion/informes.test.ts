import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  torada: vi.fn(), servicios: vi.fn(), estados: vi.fn(), lote: vi.fn(), histAbiertos: vi.fn(), histCerrar: vi.fn(), histCrear: vi.fn(), audit: vi.fn(),
  raw: vi.fn(), nacido: vi.fn(), previsto: vi.fn(), madre: vi.fn(), categoria: vi.fn(), tactos: vi.fn(), partos: vi.fn(),
}))
vi.mock("@/lib/reproduccion/estado", () => ({ estadosReproductivos: m.estados }))
vi.mock("@/lib/reproduccion/agenda", () => ({ DIAS_DESTETE: { bovino: 180, ovino: 90 }, sincronizarTareasReproductivas: async () => ({}) }))
vi.mock("@/lib/prisma", () => {
  const tx = { animalLoteHist: { findMany: m.histAbiertos, updateMany: m.histCerrar, create: m.histCrear }, auditLog: { create: m.audit } }
  return {
    prisma: {
      torada: { findFirst: m.torada },
      evtServicio: { findMany: m.servicios },
      evtTacto: { findFirst: m.previsto, findMany: m.tactos },
      evtParicion: { findMany: m.partos },
      animal: { findFirst: m.nacido, findUnique: m.madre },
      categoria: { findFirst: m.categoria },
      lote: { findFirst: m.lote },
      $queryRaw: m.raw,
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { anclasSugeridas, apartarVacias, hojaDeServicio, pronosticoPartos, recategorizacionSugerida } from "@/lib/reproduccion/informes"
import type { AuthContext } from "@/lib/api/with-auth"

const EST = "00000000-0000-4000-8000-000000000001", TOR = "00000000-0000-4000-8000-000000000002", DEST = "00000000-0000-4000-8000-000000000003", BOV = "B"
const rol = (roles: string[]) => ({
  userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []),
}) as unknown as AuthContext
const encargado = rol(["encargado"]), vet = rol(["vet"])
const d = (s: string) => new Date(`${s}T00:00:00Z`)

beforeEach(() => {
  vi.resetAllMocks()
  m.torada.mockResolvedValue({ id: TOR, nombre: "Otoño", tipo: "natural", tipoGrupo: "torada", fechaInicio: d("2026-04-01"), fechaFin: null, loteId: "L1", lote: { nombre: "Vacas", establecimientoId: EST, especieId: BOV } })
  m.histAbiertos.mockResolvedValue([])
})

describe("apartar vacías", () => {
  beforeEach(() => {
    m.servicios.mockResolvedValue([{ hembraId: "H1", hembra: { caravanaVisual: "V-1", cuig: null } }, { hembraId: "H2", hembra: { caravanaVisual: "V-2", cuig: null } }])
    m.estados.mockResolvedValue(new Map([["H1", { estado: "vacia" }], ["H2", { estado: "preñada" }]]))
  })
  it("mueve solo las vacías al grupo elegido (admin/encargado), sin darlas de baja", async () => {
    m.lote.mockResolvedValue({ activo: true, especieId: BOV, nombre: "Descarte" })
    await expect(apartarVacias(encargado, TOR, { loteDestinoId: DEST })).resolves.toEqual({ movidas: 1, grupo: "Descarte" })
    expect(m.histCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId: "H1", loteId: DEST, motivo: "vacia" }) })
    expect(m.histCrear).toHaveBeenCalledOnce()
  })
  it("rechaza a un vet, un grupo de otra especie y si no hay vacías", async () => {
    await expect(apartarVacias(vet, TOR, { loteDestinoId: DEST })).rejects.toMatchObject({ status: 403 })
    m.lote.mockResolvedValue({ activo: true, especieId: "OTRA", nombre: "X" })
    await expect(apartarVacias(encargado, TOR, { loteDestinoId: DEST })).rejects.toThrow(/misma especie/)
    m.estados.mockResolvedValue(new Map())
    await expect(apartarVacias(encargado, TOR, { loteDestinoId: DEST })).rejects.toThrow(/no tiene hembras vacías/)
  })
})

describe("fechas ancla para el plan sanitario", () => {
  it("inicio del servicio de la torada del año y destete del primer parto + 180 días", async () => {
    m.torada.mockResolvedValue({ nombre: "Otoño 2026", fechaInicio: d("2026-04-01") })
    m.nacido.mockResolvedValue(null)
    m.previsto.mockResolvedValue({ fechaProbableParto: d("2026-01-10"), hembra: { especie: { nombre: "bovino" } } })
    await expect(anclasSugeridas(encargado, EST, 2026)).resolves.toMatchObject({ fechaPreServicio: "2026-04-01", origenPreServicio: "Inicio de «Otoño 2026»", fechaDestete: "2026-07-09" })
  })
  it("sin datos del año no sugiere nada; un destete que cae en otro año tampoco", async () => {
    m.torada.mockResolvedValue(null)
    m.nacido.mockResolvedValue({ fechaNacimiento: d("2026-09-01"), especie: { nombre: "bovino" } })
    m.previsto.mockResolvedValue(null)
    await expect(anclasSugeridas(encargado, EST, 2026)).resolves.toMatchObject({ fechaPreServicio: null, fechaDestete: null })
  })
})

describe("informes", () => {
  it("hoja de servicio: una fila por hembra con su último servicio, tacto y parto", async () => {
    m.servicios.mockResolvedValue([
      { fecha: d("2026-04-01"), tipo: "natural", toroNombre: null, hembraId: "H1", hembra: { caravanaVisual: "V-10", cuig: null, categoria: { nombre: "vaca" } }, macho: { caravanaVisual: "T-1", cuig: null } },
      { fecha: d("2026-04-21"), tipo: "natural", toroNombre: null, hembraId: "H1", hembra: { caravanaVisual: "V-10", cuig: null, categoria: { nombre: "vaca" } }, macho: { caravanaVisual: "T-1", cuig: null } },
      { fecha: d("2026-04-01"), tipo: "ia", toroNombre: "Toro IA", hembraId: "H2", hembra: { caravanaVisual: "V-2", cuig: null, categoria: null }, macho: null },
    ])
    m.tactos.mockResolvedValue([{ hembraId: "H1", fecha: d("2026-06-15"), resultado: "preñada", mesesGest: 2, fechaProbableParto: d("2027-01-28") }])
    m.partos.mockResolvedValue([])
    const r = await hojaDeServicio(encargado, TOR)
    expect(r.filas.map((f) => [f.hembra, f.servicios, f.ultimoServicio, f.macho, f.tacto?.resultado ?? null])).toEqual([
      ["V-2", 1, "2026-04-01", "Toro IA", null],
      ["V-10", 2, "2026-04-21", "T-1", "preñada"],
    ])
  })
  it("pronóstico: preñadas por mes con el detalle por grupo", async () => {
    m.raw.mockResolvedValue([{ mes: "2027-01", grupo: "Vacas", cantidad: 30 }, { mes: "2027-01", grupo: null, cantidad: 2 }, { mes: "2027-02", grupo: "Vacas", cantidad: 10 }])
    await expect(pronosticoPartos(encargado, EST)).resolves.toEqual({ porMes: [
      { mes: "2027-01", total: 32, grupos: [{ grupo: "Vacas", cantidad: 30 }, { grupo: "Sin grupo", cantidad: 2 }] },
      { mes: "2027-02", total: 10, grupos: [{ grupo: "Vacas", cantidad: 10 }] },
    ] })
  })
  it("recategorización sugerida al primer parto", async () => {
    m.madre.mockResolvedValue({ especieId: BOV, categoria: { nombre: "Vaquillona" } })
    m.categoria.mockResolvedValue({ id: "C-VACA", nombre: "vaca" })
    await expect(recategorizacionSugerida("H1", "o1")).resolves.toEqual({ categoriaId: "C-VACA", nombre: "vaca", desde: "Vaquillona" })
    m.madre.mockResolvedValue({ especieId: BOV, categoria: { nombre: "vaca" } })
    await expect(recategorizacionSugerida("H1", "o1")).resolves.toBeNull()
  })
})
