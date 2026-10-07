import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  cuentaFindFirst: vi.fn(),
  cuentaFindMany: vi.fn(),
  cuentaCreate: vi.fn(),
  cuentaUpdate: vi.fn(),
  cuentaDelete: vi.fn(),
  movCount: vi.fn(),
  movFindFirst: vi.fn(),
  movCreate: vi.fn(),
  movCreateMany: vi.fn(),
  movDeleteMany: vi.fn(),
  movGroupBy: vi.fn(),
  comprobanteFindFirst: vi.fn(),
  audit: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cuentaFinanciera: { findFirst: m.cuentaFindFirst, findMany: m.cuentaFindMany, create: m.cuentaCreate, update: m.cuentaUpdate, delete: m.cuentaDelete },
    movimientoFinanciero: {
      count: m.movCount,
      findFirst: m.movFindFirst,
      create: m.movCreate,
      createMany: m.movCreateMany,
      deleteMany: m.movDeleteMany,
      groupBy: m.movGroupBy,
    },
    comprobante: { findFirst: m.comprobanteFindFirst },
  },
}))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: m.audit }))
import {
  actualizarCuenta,
  camposLectura,
  crearMovimiento,
  eliminarCuenta,
  eliminarMovimiento,
  listarCuentas,
  registrarTransferencia,
} from "@/lib/finanzas/service"
import type { AuthContext } from "@/lib/api/with-auth"

const estAdmin = "00000000-0000-4000-8000-0000000000a1"
const estOperario = "00000000-0000-4000-8000-0000000000b1"
const c1 = "00000000-0000-4000-8000-0000000000c1"
const c2 = "00000000-0000-4000-8000-0000000000c2"
const roles: Record<string, string> = { [estAdmin]: "admin", [estOperario]: "operario" }
const ctx = {
  userId: "u1",
  establecimientoIds: [estAdmin, estOperario],
  organizacionDeEstablecimiento: { [estAdmin]: "org1", [estOperario]: "org2" },
  establecimientoIdsConRol: (r: string[]) => Object.keys(roles).filter((e) => r.includes(roles[e])),
} as unknown as AuthContext

const dec = (v: string) => ({ toString: () => v, valueOf: () => Number(v) })
const cuenta = (id: string, extra: object = {}) => ({ id, nombre: id === c1 ? "Caja" : "Banco", establecimientoId: estAdmin, activa: true, moneda: "ARS", saldoInicial: "1000", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.movGroupBy.mockResolvedValue([])
})

describe("alcance por rol en la organización del campo", () => {
  it("solo admin/encargado ven finanzas; un operario recibe 403", () => {
    expect(camposLectura(ctx)).toEqual([estAdmin])
    expect(() => camposLectura(ctx, estOperario)).toThrow(/permisos/)
  })
  it("no se registra en un campo donde el usuario es operario", async () => {
    await expect(
      crearMovimiento(ctx, {
        establecimientoId: estOperario, cuentaId: c1, tipo: "egreso", categoria: "sanidad", subcategoria: null, fecha: "2026-01-10",
        importe: "100", descripcion: "x", contraparte: null, cuit: null, medioPago: null, notas: null, comprobanteId: null,
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(m.movCreate).not.toHaveBeenCalled()
  })
})

describe("movimientos", () => {
  const input = {
    establecimientoId: estAdmin, cuentaId: c1, tipo: "egreso" as const, categoria: "sanidad", subcategoria: null, fecha: "2026-01-10",
    importe: "100", descripcion: "Vacunas", contraparte: null, cuit: null, medioPago: null, notas: null, comprobanteId: null,
  }
  it("rechaza cuentas de otro campo o desactivadas", async () => {
    m.cuentaFindFirst.mockResolvedValueOnce(null)
    await expect(crearMovimiento(ctx, input)).rejects.toThrow(/no pertenece/)
    m.cuentaFindFirst.mockResolvedValueOnce(cuenta(c1, { activa: false }))
    await expect(crearMovimiento(ctx, input)).rejects.toThrow(/desactivada/)
  })
  it("crea con autor, fecha de calendario y audita en la organización dueña", async () => {
    m.cuentaFindFirst.mockResolvedValue(cuenta(c1))
    m.movCreate.mockResolvedValue({ id: "m1", fecha: new Date("2026-01-10T00:00:00Z"), importe: dec("100"), cuenta: { moneda: "ARS" } })
    const r = await crearMovimiento(ctx, input)
    expect(m.movCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creadoPorId: "u1", fecha: new Date("2026-01-10T00:00:00Z") }) }),
    )
    expect(r).toMatchObject({ fecha: "2026-01-10", importe: 100, moneda: "ARS" })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ tabla: "movimientos_financieros", organizacionId: "org1" }))
  })
  it("eliminar una pata de transferencia borra las dos", async () => {
    m.movFindFirst.mockResolvedValue({ id: "m1", establecimientoId: estAdmin, transferenciaId: "t1", importe: dec("5"), tipo: "egreso" })
    m.movDeleteMany.mockResolvedValue({ count: 2 })
    expect(await eliminarMovimiento(ctx, "m1")).toEqual({ eliminados: 2 })
    expect(m.movDeleteMany).toHaveBeenCalledWith({ where: { transferenciaId: "t1", establecimientoId: estAdmin } })
  })
})

describe("transferencias", () => {
  const base = { establecimientoId: estAdmin, cuentaOrigenId: c1, cuentaDestinoId: c2, fecha: "2026-01-10", importe: "1000", importeDestino: null, descripcion: null, notas: null }
  it("crea egreso en origen e ingreso en destino con el mismo transferenciaId", async () => {
    m.cuentaFindFirst.mockImplementation(({ where }: { where: { id: string } }) => cuenta(where.id))
    await registrarTransferencia(ctx, base)
    const data = m.movCreateMany.mock.calls[0][0].data
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ cuentaId: c1, tipo: "egreso", importe: "1000", categoria: "transferencia" })
    expect(data[1]).toMatchObject({ cuentaId: c2, tipo: "ingreso", importe: "1000" })
    expect(data[0].transferenciaId).toBe(data[1].transferenciaId)
  })
  it("entre monedas distintas exige el importe de destino", async () => {
    m.cuentaFindFirst.mockImplementation(({ where }: { where: { id: string } }) => cuenta(where.id, where.id === c2 ? { moneda: "USD" } : {}))
    await expect(registrarTransferencia(ctx, base)).rejects.toThrow(/USD/)
    await registrarTransferencia(ctx, { ...base, importeDestino: "0.85" })
    expect(m.movCreateMany.mock.calls[0][0].data[1]).toMatchObject({ importe: "0.85" })
  })
  it("en la misma moneda los importes deben coincidir", async () => {
    m.cuentaFindFirst.mockImplementation(({ where }: { where: { id: string } }) => cuenta(where.id))
    await expect(registrarTransferencia(ctx, { ...base, importeDestino: "999" })).rejects.toMatchObject({ status: 400 })
  })
})

describe("cuentas", () => {
  it("calcula el saldo con saldo inicial, ingresos y egresos", async () => {
    m.cuentaFindMany.mockResolvedValue([cuenta(c1)])
    m.movGroupBy.mockResolvedValue([
      { cuentaId: c1, tipo: "ingreso", _sum: { importe: "500.50" }, _count: { _all: 2 } },
      { cuentaId: c1, tipo: "egreso", _sum: { importe: "200.25" }, _count: { _all: 1 } },
    ])
    const [c] = await listarCuentas(ctx)
    expect(c).toMatchObject({ saldo: 1300.25, saldoInicial: 1000, cantidadMovimientos: 3 })
  })
  it("no cambia la moneda ni elimina una cuenta con movimientos", async () => {
    m.cuentaFindFirst.mockResolvedValue(cuenta(c1))
    m.movCount.mockResolvedValue(3)
    await expect(actualizarCuenta(ctx, c1, { moneda: "USD" })).rejects.toMatchObject({ status: 409 })
    await expect(eliminarCuenta(ctx, c1)).rejects.toMatchObject({ status: 409 })
    expect(m.cuentaUpdate).not.toHaveBeenCalled()
    expect(m.cuentaDelete).not.toHaveBeenCalled()
  })
})
