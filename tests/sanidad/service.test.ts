import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), lote: vi.fn(), producto: vi.fn(), loteProducto: vi.fn(), crear: vi.fn(), audit: vi.fn(), descontar: vi.fn(),
  findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), productos: vi.fn(), animales: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = { evtSanidad: { create: m.crear }, auditLog: { create: m.audit } }
  return {
    prisma: {
      animal: { findFirst: m.animal, findMany: m.animales },
      lote: { findFirst: m.lote },
      producto: { findFirst: m.producto, findMany: m.productos },
      loteProducto: { findFirst: m.loteProducto },
      evtSanidad: { findMany: m.findMany, count: m.count, groupBy: m.groupBy, aggregate: m.aggregate },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
vi.mock("@/lib/inventario/aplicaciones", () => ({ descontarAplicacion: m.descontar }))
import { listarSanidad, registrarSanidad, resumenSanidad } from "@/lib/sanidad/service"
import { registroSanitarioSchema } from "@/lib/sanidad/validation"
import { hoyArgentina } from "@/lib/inventario/fechas"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ANIMAL = uuid(1), LOTE = uuid(2), PROD = uuid(3), EST1 = uuid(10), EST2 = uuid(11), AJENO = uuid(12)
// EST1: el usuario es vet (puede registrar) · EST2: operario (solo ve)
const ctx = {
  userId: "u1", establecimientoIds: [EST1, EST2], organizacionIds: ["o1"],
  organizacionDeEstablecimiento: { [EST1]: "o1", [EST2]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.includes("vet") ? [EST1] : []),
} as unknown as AuthContext
const base = (extra: object = {}) => ({ animalId: ANIMAL, productoId: PROD, fecha: "2026-01-15", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.animal.mockResolvedValue({ id: ANIMAL, caravanaVisual: "A-1", estadoVital: "activo", establecimientoId: EST1 })
  m.producto.mockResolvedValue({ id: PROD, activo: true, organizacionId: "o1" })
  m.crear.mockImplementation(async ({ data }) => ({ id: "E1", ...data, costo: null, animal: null, producto: { id: PROD }, loteProducto: null, lote: null }))
  m.descontar.mockResolvedValue({ descontado: 5, faltante: 0, unidad: "ml", ubicacion: null })
})

describe("validación del registro", () => {
  it("exige animal o grupo (no ambos) y rechaza fecha futura", () => {
    expect(registroSanitarioSchema.safeParse({ productoId: PROD, fecha: "2026-01-01" }).success).toBe(false)
    expect(registroSanitarioSchema.safeParse(base({ loteId: LOTE })).success).toBe(false)
    expect(registroSanitarioSchema.safeParse(base({ fecha: "2999-01-01" })).success).toBe(false)
  })
  it("toma un instante ISO como día de Argentina y acepta decimales con coma", () => {
    const r = registroSanitarioSchema.parse(base({ fecha: "2026-01-16T01:30:00.000Z", dosis: "5,5" }))
    // 01:30 UTC del 16 son las 22:30 del 15 en Argentina
    expect(r.fecha).toBe("2026-01-15")
    expect(r.dosis).toBe(5.5)
  })
})

describe("registro sanitario", () => {
  it("registra con auditoría y descuenta stock en la misma transacción", async () => {
    const r = await registrarSanidad(ctx, base({ descontarStock: "5", motivo: "preventivo" }))
    expect(m.crear.mock.calls[0][0].data).toMatchObject({ animalId: ANIMAL, loteId: null, productoId: PROD, motivo: "preventivo", fecha: new Date("2026-01-15T00:00:00Z") })
    expect(m.descontar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cantidad: 5, origenTipo: "sanidad", origenId: "E1" }), expect.objectContaining({ estricto: true, establecimientoId: EST1 }))
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ tabla: "evt_sanidad", rowPk: "E1", organizacionId: "o1" })
    expect(r.stock).toMatchObject({ descontado: 5 })
  })
  it("sin rol sanitario en el campo del animal responde 403", async () => {
    m.animal.mockResolvedValue({ id: ANIMAL, caravanaVisual: "A-1", estadoVital: "activo", establecimientoId: EST2 })
    await expect(registrarSanidad(ctx, base())).rejects.toMatchObject({ status: 403 })
    expect(m.crear).not.toHaveBeenCalled()
  })
  it("rechaza animales dados de baja y grupos inactivos", async () => {
    m.animal.mockResolvedValue({ id: ANIMAL, caravanaVisual: "A-1", estadoVital: "vendido", establecimientoId: EST1 })
    await expect(registrarSanidad(ctx, base())).rejects.toThrow(/dado de baja/)
    m.lote.mockResolvedValue({ id: LOTE, nombre: "Recría", activo: false, establecimientoId: EST1 })
    await expect(registrarSanidad(ctx, { productoId: PROD, loteId: LOTE, fecha: "2026-01-15" })).rejects.toThrow(/inactivo/)
  })
  it("el producto debe ser de la organización; uno del catálogo general no descuenta", async () => {
    m.producto.mockResolvedValueOnce(null)
    await expect(registrarSanidad(ctx, base())).rejects.toMatchObject({ status: 404 })
    m.producto.mockResolvedValueOnce({ id: PROD, activo: true, organizacionId: null })
    await expect(registrarSanidad(ctx, base({ descontarStock: 2 }))).rejects.toThrow(/catálogo general/)
    m.producto.mockResolvedValueOnce({ id: PROD, activo: true, organizacionId: null })
    await expect(registrarSanidad(ctx, base())).resolves.toMatchObject({ stock: null })
  })
  it("un lote de otro producto se rechaza", async () => {
    m.loteProducto.mockResolvedValue(null)
    await expect(registrarSanidad(ctx, base({ loteProductoId: uuid(9) }))).rejects.toThrow(/no pertenece/)
  })
})

describe("consultas por campo", () => {
  it("el historial filtra por el campo pedido y rechaza campos ajenos", async () => {
    m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0)
    await listarSanidad(ctx, { establecimientoId: EST1, q: "A-1", motivo: "curativo" })
    const where = m.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain(EST1)
    expect(JSON.stringify(where)).not.toContain(EST2)
    expect(JSON.stringify(where)).toContain("curativo")
    await expect(listarSanidad(ctx, { establecimientoId: AJENO })).rejects.toMatchObject({ status: 404 })
    await expect(listarSanidad(ctx, { establecimientoId: EST1, limit: 5000 })).rejects.toThrow()
  })
  it("el resumen agrega en la base y arma el calendario del mes pedido", async () => {
    m.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2)
    m.groupBy.mockImplementation(async (q: { by: string[] }) => {
      if (q.by[0] === "animalId") return [{ animalId: "a" }, { animalId: "b" }]
      if (q.by[0] === "productoId") return [{ productoId: PROD, _count: { _all: 5 } }]
      return [{ fecha: new Date("2025-12-03T00:00:00Z"), _count: { _all: 4 } }]
    })
    m.aggregate.mockResolvedValue({ _sum: { cantidadAnimales: 30 } })
    m.productos.mockResolvedValue([{ id: PROD, nombre: "Ivermectina" }])
    const r = await resumenSanidad(ctx, { establecimientoId: EST1, mes: "2025-12" })
    expect(r).toMatchObject({ tratamientosMes: 7, curativosMes: 2, animalesTratadosMes: 32, topProductos: [{ nombre: "Ivermectina", cantidad: 5 }], calendario: { mes: "2025-12", dias: [{ dia: "2025-12-03", cantidad: 4 }] } })
    expect(r.mes).toBe(hoyArgentina().slice(0, 7))
    // Diciembre termina el 1/1 del año siguiente
    const cal = m.groupBy.mock.calls.find((c) => c[0].by[0] === "fecha")![0]
    expect(JSON.stringify(cal.where)).toContain("2026-01-01T00:00:00.000Z")
  })
})
