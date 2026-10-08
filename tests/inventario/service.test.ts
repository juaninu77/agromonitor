import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  producto: vi.fn(), prodCreate: vi.fn(), lote: vi.fn(), loteCreate: vi.fn(), proveedor: vi.fn(),
  movUnique: vi.fn(), movCreate: vi.fn(), groupBy: vi.fn(), audit: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    producto: { findFirst: m.producto, create: m.prodCreate },
    loteProducto: { findFirst: m.lote, create: m.loteCreate },
    proveedor: { findFirst: m.proveedor },
    movimientoStock: { findUnique: m.movUnique, create: m.movCreate, groupBy: m.groupBy },
    auditLog: { create: m.audit },
  }
  return { prisma: { $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { crearLote, crearProducto, registrarMovimientoStock } from "@/lib/inventario/service"
import { estadoVencimiento, formatoDia, textoVencimiento } from "@/lib/inventario/fechas"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const PROD = uuid(1), LOTE = uuid(2)
// o1: admin · o2: operario
const ctx = {
  userId: "u1", organizacionIds: ["o1", "o2"],
  organizacionIdsConRol: (r: string[]) => (r.includes("admin") ? ["o1"] : []),
} as unknown as AuthContext
const saldo = (entradas: number, salidas = 0, ajustes = 0) => [
  { tipo: "entrada", _sum: { cantidad: entradas } }, { tipo: "salida", _sum: { cantidad: salidas } }, { tipo: "ajuste", _sum: { cantidad: ajustes } },
]
const mov = (extra: object = {}) => ({ productoId: PROD, tipo: "salida", cantidad: 5, ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.producto.mockResolvedValue({ id: PROD, nombre: "Ivermectina", organizacionId: "o1" })
  m.movUnique.mockResolvedValue(null)
  m.groupBy.mockResolvedValue(saldo(10))
  m.movCreate.mockImplementation(async ({ data }) => ({ id: "m1", ...data, createdAt: new Date() }))
})

describe("permisos por organización", () => {
  it("un operario no puede registrar movimientos en su organización", async () => {
    m.producto.mockResolvedValueOnce({ id: PROD, nombre: "X", organizacionId: "o2" })
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "entrada" }))).rejects.toMatchObject({ status: 403 })
    expect(m.movCreate).not.toHaveBeenCalled()
  })
  it("no se cargan lotes ni stock en productos del catálogo general", async () => {
    m.producto.mockResolvedValue({ id: PROD, nombre: "Global", organizacionId: null })
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "entrada" }))).rejects.toThrow(/catálogo general/)
    await expect(crearLote(ctx, PROD, { nroLote: "A1" })).rejects.toThrow(/catálogo general/)
    expect(m.loteCreate).not.toHaveBeenCalled()
  })
  it("un producto nuevo va a la organización donde es admin/encargado", async () => {
    m.prodCreate.mockImplementation(async ({ data }) => ({ id: "p", ...data }))
    await expect(crearProducto(ctx, { nombre: "Vacuna aftosa", tipo: "vacuna" })).resolves.toMatchObject({ organizacionId: "o1", retiroDias: 0 })
    await expect(crearProducto(ctx, { nombre: "X", tipo: "vacuna", organizacionId: uuid(9) })).rejects.toMatchObject({ status: 403 })
    await expect(crearProducto(ctx, { nombre: "X", tipo: "inventado" })).rejects.toThrow()
  })
  it("valida el lote (sin costos negativos ni proveedores de otra organización)", async () => {
    await expect(crearLote(ctx, PROD, { nroLote: "A1", costo: -5 })).rejects.toThrow(/negativo/)
    m.proveedor.mockResolvedValueOnce(null)
    await expect(crearLote(ctx, PROD, { nroLote: "A1", proveedorId: uuid(7) })).rejects.toMatchObject({ status: 404 })
    m.loteCreate.mockImplementation(async ({ data }) => ({ id: LOTE, ...data }))
    await crearLote(ctx, PROD, { nroLote: "A1", vencimiento: "2027-03-31", cantidad: "10" })
    expect(m.loteCreate.mock.calls[0][0].data).toMatchObject({ vencimiento: new Date("2027-03-31T00:00:00Z"), cantidad: 10 })
  })
})

describe("saldo, ajustes e idempotencia", () => {
  it("rechaza una salida mayor al stock", async () => {
    m.groupBy.mockResolvedValue(saldo(10, 4, -2)) // stock 4
    await expect(registrarMovimientoStock(ctx, mov({ cantidad: 5 }))).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/hay 4/) })
    await expect(registrarMovimientoStock(ctx, mov({ cantidad: 4 }))).resolves.toBeTruthy()
  })
  it("un ajuste que resta se guarda negativo y necesita motivo", async () => {
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar" }))).rejects.toThrow(/motivo/)
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste" , motivo: "recuento" }))).rejects.toThrow(/suma o resta/)
    await registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar", cantidad: 3, motivo: "Recuento" }))
    expect(m.movCreate.mock.calls[0][0].data).toMatchObject({ tipo: "ajuste", cantidad: -3 })
    m.groupBy.mockResolvedValue(saldo(2))
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar", cantidad: 3, motivo: "Recuento" }))).rejects.toMatchObject({ status: 409 })
  })
  it("una entrada no consulta saldo; el sentido solo vale en ajustes", async () => {
    await registrarMovimientoStock(ctx, mov({ tipo: "entrada", cantidad: 100 }))
    expect(m.groupBy).not.toHaveBeenCalled()
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "entrada", sentido: "sumar" }))).rejects.toThrow(/solo aplica/)
  })
  it("un reintento con la misma clave devuelve el original", async () => {
    const prior = { id: "m0", productoId: PROD, tipo: "salida", cantidad: 5, loteProductoId: null }
    m.movUnique.mockResolvedValue(prior)
    await expect(registrarMovimientoStock(ctx, mov({ clave: uuid(5) }))).resolves.toMatchObject({ movimiento: prior, repetido: true })
    await expect(registrarMovimientoStock(ctx, mov({ clave: uuid(5), cantidad: 6 }))).rejects.toMatchObject({ status: 409 })
    expect(m.movCreate).not.toHaveBeenCalled()
  })
  it("rechaza fechas futuras y lotes de otro producto", async () => {
    await expect(registrarMovimientoStock(ctx, mov({ fecha: "2999-01-01" }))).rejects.toThrow(/futura/)
    m.lote.mockResolvedValueOnce(null)
    await expect(registrarMovimientoStock(ctx, mov({ loteProductoId: LOTE }))).rejects.toThrow(/lote/)
  })
})

describe("vencimientos en hora de Argentina", () => {
  const venc = new Date("2026-10-08T00:00:00Z")
  it("un lote vence al terminar su día", () => {
    expect(estadoVencimiento(venc, { hoy: "2026-10-08" })).toMatchObject({ vencido: false, proximoAVencer: true, diasRestantes: 0 })
    expect(estadoVencimiento(venc, { hoy: "2026-10-09" })).toMatchObject({ vencido: true, diasRestantes: -1 })
    expect(estadoVencimiento(venc, { hoy: "2026-09-07" })).toMatchObject({ proximoAVencer: false, diasRestantes: 31 })
    expect(estadoVencimiento(null)).toMatchObject({ vencido: false, diasRestantes: null })
  })
  it("se muestra el día guardado, sin correrse por zona horaria", () => {
    expect(formatoDia("2026-10-08T00:00:00.000Z")).toBe("08/10/2026")
    expect([0, 1, 3, -2].map(textoVencimiento)).toEqual(["vence hoy", "vence en 1 día", "vence en 3 días", "venció hace 2 días"])
  })
})
