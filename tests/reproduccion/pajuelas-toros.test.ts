import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), tactoUlt: vi.fn(), servCount: vi.fn(), producto: vi.fn(), lote: vi.fn(), loteTx: vi.fn(), crear: vi.fn(), audit: vi.fn(),
  descontar: vi.fn(), revertir: vi.fn(), raw: vi.fn(), servicioEv: vi.fn(), anular: vi.fn(),
}))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: async () => ({}) }))
vi.mock("@/lib/inventario/aplicaciones", () => ({ descontarAplicacion: m.descontar, revertirAplicaciones: m.revertir }))
vi.mock("@/lib/prisma", () => {
  const tx = { evtServicio: { create: m.crear, updateMany: m.anular }, loteProducto: { findUnique: m.loteTx }, auditLog: { create: m.audit } }
  return {
    prisma: {
      animal: { findFirst: m.animal },
      evtTacto: { findFirst: m.tactoUlt },
      evtServicio: { count: m.servCount, findFirst: m.servicioEv },
      producto: { findFirst: m.producto },
      loteProducto: { findFirst: m.lote },
      $queryRaw: m.raw,
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { anularEvento, registrarServicio } from "@/lib/reproduccion/service"
import { desempenoPorToro } from "@/lib/reproduccion/toros"
import type { AuthContext } from "@/lib/api/with-auth"

const EST = "00000000-0000-4000-8000-000000000001", VACA = "00000000-0000-4000-8000-000000000002", PAJ = "00000000-0000-4000-8000-000000000003"
const ctx = { userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" }, establecimientoIdsConRol: () => [EST] } as unknown as AuthContext

beforeEach(() => {
  vi.resetAllMocks()
  m.animal.mockResolvedValue({ id: VACA, sexo: "F", estadoVital: "activo", especieId: "B", establecimientoId: EST, fechaNacimiento: new Date("2020-01-01"), caravanaVisual: "V-1", cuig: null, caravanaRfid: null, especie: { nombre: "bovino" } })
  m.servCount.mockResolvedValue(0)
  m.producto.mockResolvedValue({ id: PAJ, nombre: "Angus Max", tipo: "semen", activo: true })
  m.descontar.mockResolvedValue({ descontado: 1, faltante: 0, unidad: "pajuelas", ubicacion: null, lotes: [{ loteProductoId: "LP1", cantidad: 1 }] })
  m.loteTx.mockResolvedValue({ nroLote: "P-77" })
  m.crear.mockImplementation(async ({ data }: { data: object }) => data)
})

describe("pajuelas en el servicio", () => {
  it("IA con pajuela: descuenta 1 vinculada al servicio y completa toro y partida", async () => {
    const s = await registrarServicio(ctx, { hembraId: VACA, fecha: "2026-10-01", tipo: "ia", productoSemenId: PAJ }) as { id: string; toroNombre: string; loteSemen: string; loteProductoId: string }
    expect(m.descontar).toHaveBeenCalledOnce()
    expect(m.descontar.mock.calls[0][1]).toMatchObject({ productoId: PAJ, cantidad: 1, origenTipo: "servicio", origenId: s.id })
    expect(m.descontar.mock.calls[0][2]).toMatchObject({ estricto: true })
    expect(s).toMatchObject({ toroNombre: "Angus Max", loteSemen: "P-77", loteProductoId: "LP1", productoSemenId: PAJ })
  })
  it("solo semen de la organización, activo; nunca en monta natural", async () => {
    m.producto.mockResolvedValue({ id: PAJ, nombre: "Ivermectina", tipo: "antiparasitario", activo: true })
    await expect(registrarServicio(ctx, { hembraId: VACA, fecha: "2026-10-01", tipo: "ia", productoSemenId: PAJ })).rejects.toMatchObject({ status: 404 })
    expect(m.producto.mock.calls[0][0].where).toMatchObject({ organizacionId: "o1" })
    await expect(registrarServicio(ctx, { hembraId: VACA, fecha: "2026-10-01", tipo: "natural", productoSemenId: PAJ })).rejects.toThrow(/solo para IA/)
    expect(m.descontar).not.toHaveBeenCalled()
  })
  it("anular el servicio devuelve la pajuela", async () => {
    m.servicioEv.mockResolvedValue({ id: "S1", fecha: new Date("2026-10-01"), anuladoAt: null, establecimientoId: EST, tacto: null })
    m.revertir.mockResolvedValue({ revertido: 1, productoIds: [PAJ] })
    const r = await anularEvento(ctx, "servicio", "S1", { motivo: "vaca equivocada" })
    expect(m.revertir).toHaveBeenCalledWith(expect.anything(), ["S1"], "vaca equivocada", "servicio")
    expect(r.aviso).toMatch(/pajuela volvió/)
  })
})

describe("desempeño por toro", () => {
  it("calcula % preñez sobre tactados, distribución de partos y ordena por preñez", async () => {
    m.raw.mockResolvedValue([
      { clave: "m:T1", nombre: "T-1", tipo: "natural", servicios: 30, servidas: 25, tactadas: 20, prenadas: 15, partos: 12, nacidos_vivos: 12, abortos: 1, cabeza: 6, cuerpo: 4, cola: 2, dificultad: 1.25, destetados: 10, peso_destete: 181.6 },
      { clave: "s:P1", nombre: "Angus Max", tipo: "ia", servicios: 10, servidas: 10, tactadas: 10, prenadas: 9, partos: 0, nacidos_vivos: 0, abortos: 0, cabeza: 0, cuerpo: 0, cola: 0, dificultad: null, destetados: 0, peso_destete: null },
      { clave: "t:X", nombre: "Otoño · 3 toros", tipo: "natural", servicios: 5, servidas: 5, tactadas: 0, prenadas: 0, partos: 0, nacidos_vivos: 0, abortos: 0, cabeza: 0, cuerpo: 0, cola: 0, dificultad: null, destetados: 0, peso_destete: null },
    ])
    const r = await desempenoPorToro(ctx, EST, 2026)
    expect(r.toros.map((t) => [t.nombre, t.origen, t.porcentajePrenez])).toEqual([["Angus Max", "pajuela", 90], ["T-1", "rodeo", 75], ["Otoño · 3 toros", "torada", null]])
    expect(r.toros[1]).toMatchObject({ distribucion: { cabeza: 50, cuerpo: 33.3, cola: 16.7 }, dificultadParto: 1.3, pesoDestete: 182 })
    await expect(desempenoPorToro({ ...ctx, establecimientoIds: [] } as unknown as AuthContext, EST, 2026)).rejects.toMatchObject({ status: 404 })
  })
})
