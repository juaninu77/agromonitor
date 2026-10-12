import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  destete: vi.fn(), desteteTx: vi.fn(), pesada: vi.fn(), pesadaVieja: vi.fn(), pesadaBorrar: vi.fn(), tramo: vi.fn(), anteriores: vi.fn(),
  histBorrar: vi.fn(), histReabrir: vi.fn(), anular: vi.fn(), audit: vi.fn(), senalada: vi.fn(), senaladaCrear: vi.fn(), lote: vi.fn(),
  producto: vi.fn(), descontar: vi.fn(), revertir: vi.fn(),
}))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: async () => ({ creadas: 0, cumplidas: 0 }) }))
vi.mock("@/lib/inventario/aplicaciones", () => ({ descontarAplicacion: m.descontar, revertirAplicaciones: m.revertir }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    evtDestete: { findUniqueOrThrow: m.desteteTx, updateMany: m.anular },
    evtSenalada: { updateMany: m.anular, create: m.senaladaCrear },
    evtPesada: { findUnique: m.pesada, findFirst: m.pesadaVieja, delete: m.pesadaBorrar },
    animalLoteHist: { findFirst: m.tramo, findMany: m.anteriores, delete: m.histBorrar, updateMany: m.histReabrir },
    auditLog: { create: m.audit },
  }
  return {
    prisma: {
      evtDestete: { findFirst: m.destete },
      evtSenalada: { findFirst: m.senalada, findUnique: async () => null },
      lote: { findFirst: m.lote },
      torada: { count: async () => 1 },
      producto: { findFirst: m.producto },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { anularEvento } from "@/lib/reproduccion/service"
import { registrarSenalada } from "@/lib/reproduccion/grupos"
import type { AuthContext } from "@/lib/api/with-auth"

const EST = "00000000-0000-4000-8000-000000000001", DES = "00000000-0000-4000-8000-000000000002", LOTE = "00000000-0000-4000-8000-000000000003"
const VAC = "00000000-0000-4000-8000-000000000004"
const rol = (roles: string[]) => ({
  userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []),
}) as unknown as AuthContext
const encargado = rol(["encargado"]), operario = rol(["operario"])
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const desde = new Date("2026-05-01T15:00:00Z")

beforeEach(() => {
  vi.resetAllMocks()
  m.destete.mockResolvedValue({ id: DES, fecha: d("2026-05-01"), anuladoAt: null, establecimientoId: EST })
  m.desteteTx.mockResolvedValue({ animalId: "A1", fecha: d("2026-05-01"), pesoKg: 180, loteDesteteId: LOTE, pesadaId: "P1" })
  m.pesada.mockResolvedValue({ id: "P1", fecha: d("2026-05-01"), pesoKg: 180 })
  m.tramo.mockResolvedValue({ id: "H2", desde, hasta: null })
  m.anteriores.mockResolvedValue([{ id: "H1", lote: { nombre: "Vacas con cría", activo: true } }])
})

describe("anular un destete deshace lo que hizo", () => {
  it("quita su pesada y vuelve el animal al grupo anterior", async () => {
    const r = await anularEvento(encargado, "destete", DES, { motivo: "ternero equivocado" })
    // El evento se busca en el campo donde ocurrió, no en el del animal hoy
    expect(m.destete.mock.calls[0][0].where).toEqual({ id: DES, establecimientoId: { in: [EST] } })
    expect(m.pesadaBorrar).toHaveBeenCalledWith({ where: { id: "P1" } })
    expect(m.histBorrar).toHaveBeenCalledWith({ where: { id: "H2" } })
    expect(m.histReabrir).toHaveBeenCalledWith({ where: { id: { in: ["H1"] } }, data: { hasta: null } })
    expect(m.anteriores.mock.calls[0][0].where).toMatchObject({ animalId: "A1", hasta: desde })
    expect(r.aviso).toMatch(/pesada del destete \(180 kg\).*Volvió al grupo Vacas con cría/)
    // La auditoría guarda la pesada quitada
    expect(m.audit.mock.calls[0][0].data.detalle.deshecho).toMatchObject({ pesadaQuitada: { id: "P1", pesoKg: 180 } })
  })
  it("respeta lo que el usuario elige y no toca un historial que cambió después", async () => {
    await anularEvento(encargado, "destete", DES, { motivo: "error de fecha", quitarPesada: false, volverGrupo: false })
    expect(m.pesadaBorrar).not.toHaveBeenCalled()
    expect(m.histBorrar).not.toHaveBeenCalled()
    // Se movió de grupo después del destete
    m.tramo.mockResolvedValue({ id: "H2", desde, hasta: new Date("2026-06-01T15:00:00Z") })
    const r = await anularEvento(encargado, "destete", DES, { motivo: "error de fecha" })
    expect(m.histBorrar).not.toHaveBeenCalled()
    expect(r.aviso).toMatch(/se movió de grupo después/)
    // Grupo anterior inactivo: queda en el de destete
    m.tramo.mockResolvedValue({ id: "H2", desde, hasta: null })
    m.anteriores.mockResolvedValue([{ id: "H1", lote: { nombre: "Viejo", activo: false } }])
    await expect(anularEvento(encargado, "destete", DES, { motivo: "error de fecha" })).resolves.toMatchObject({ aviso: expect.stringMatching(/Viejo.*inactivo/) })
    expect(m.histBorrar).not.toHaveBeenCalled()
  })
  it("un destete viejo sin pesada vinculada busca la del mismo día y peso", async () => {
    m.desteteTx.mockResolvedValue({ animalId: "A1", fecha: d("2026-05-01"), pesoKg: 180, loteDesteteId: null, pesadaId: null })
    m.pesadaVieja.mockResolvedValue({ id: "P9", fecha: d("2026-05-01"), pesoKg: 180 })
    await anularEvento(encargado, "destete", DES, { motivo: "duplicado" })
    expect(m.pesadaVieja.mock.calls[0][0].where).toMatchObject({ animalId: "A1", pesoKg: 180, observ: "Destete", destete: { is: null } })
    expect(m.pesadaBorrar).toHaveBeenCalledWith({ where: { id: "P9" } })
  })
})

describe("vacuna de la señalada", () => {
  const base = { loteId: LOTE, fecha: "2026-10-01", corderosSenalados: 100, productoClostridialId: VAC }
  beforeEach(() => {
    m.lote.mockResolvedValue({ establecimientoId: EST, activo: true, especie: { nombre: "ovino" } })
    m.senaladaCrear.mockResolvedValue({ id: "S1" })
    m.producto.mockResolvedValue({ organizacionId: "o1" })
    m.descontar.mockResolvedValue({ descontado: 200, faltante: 0, unidad: "ml", ubicacion: null, lotes: [] })
  })
  it("descuenta del stock en la misma transacción, vinculada a la señalada", async () => {
    const r = await registrarSenalada(operario, { ...base, descontarStock: "200", aceptarVencido: true })
    expect(m.descontar.mock.calls[0][1]).toMatchObject({ productoId: VAC, cantidad: 200, origenTipo: "senalada", origenId: "S1" })
    expect(m.descontar.mock.calls[0][2]).toMatchObject({ estricto: true, aceptarVencido: true, establecimientoId: EST })
    expect(r).toMatchObject({ stock: { descontado: 200, unidad: "ml" } })
    // Sin cantidad no se descuenta
    await registrarSenalada(operario, base)
    expect(m.descontar).toHaveBeenCalledOnce()
  })
  it("un producto del catálogo general no tiene stock y sin vacuna no hay descuento", async () => {
    m.producto.mockResolvedValue({ organizacionId: null })
    await expect(registrarSenalada(operario, { ...base, descontarStock: 200 })).rejects.toThrow(/catálogo general/)
    await expect(registrarSenalada(operario, { ...base, productoClostridialId: null, descontarStock: 200 })).rejects.toThrow(/Elegí la vacuna/)
  })
  it("anular la señalada devuelve la vacuna al stock", async () => {
    m.senalada.mockResolvedValue({ id: "S1", fecha: d("2026-10-01"), anuladoAt: null, lote: { establecimientoId: EST } })
    m.revertir.mockResolvedValue({ revertido: 200, productoIds: [VAC] })
    const r = await anularEvento(encargado, "senalada", "S1", { motivo: "grupo equivocado" })
    expect(m.revertir).toHaveBeenCalledWith(expect.anything(), ["S1"], "grupo equivocado", "senalada")
    expect(r.aviso).toMatch(/volvió al stock/)
  })
})
