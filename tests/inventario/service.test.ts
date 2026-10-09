import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  producto: vi.fn(), prodCreate: vi.fn(), lote: vi.fn(), loteCreate: vi.fn(), proveedor: vi.fn(),
  movUnique: vi.fn(), movCreate: vi.fn(), movMany: vi.fn(), groupBy: vi.fn(), audit: vi.fn(), lotes: vi.fn(), prodUpdate: vi.fn(),
  nombreDup: vi.fn(), loteUpdate: vi.fn(), sector: vi.fn(), auditFirst: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    // findFirst con `nombre` es el control de nombre único; el resto, el producto
    producto: { findFirst: (q: { where: { nombre?: unknown } }) => (q.where.nombre ? m.nombreDup(q) : m.producto(q)), create: m.prodCreate, update: m.prodUpdate },
    loteProducto: { findFirst: m.lote, create: m.loteCreate, findMany: m.lotes, update: m.loteUpdate },
    proveedor: { findFirst: m.proveedor },
    movimientoStock: { findUnique: m.movUnique, create: m.movCreate, findMany: m.movMany, groupBy: m.groupBy },
    auditLog: { create: m.audit, findFirst: m.auditFirst },
    sector: { findFirst: m.sector },
  }
  return { prisma: { $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
import { Prisma } from "@prisma/client"
import { actualizarLote, anularMovimiento, configurarProducto, crearLote, crearProducto, registrarMovimientoStock, registrarRecuento, transferirStock } from "@/lib/inventario/service"
import { productoConfigSchema } from "@/lib/inventario/validation"
import { repartirFefo } from "@/lib/inventario/stock"
import { estadoVencimiento, formatoDia, textoVencimiento } from "@/lib/inventario/fechas"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const PROD = uuid(1), LOTE = uuid(2)
// o1: admin · o2: operario
const ctx = {
  userId: "u1", organizacionIds: ["o1", "o2"],
  organizacionIdsConRol: (r: string[]) => (r.includes("admin") ? ["o1"] : []),
} as unknown as AuthContext
const D = (n: number) => new Prisma.Decimal(n)
// Saldos agrupados (por producto y por lote); `lotes` reparte el saldo por lote (null = sin lote)
const saldo = (entradas: number, salidas = 0, ajustes = 0, lotes: Record<string, number> = {}) => (q: { by: string[] }) => {
  if (!q.by.includes("loteProductoId")) return [
    { productoId: PROD, tipo: "entrada", _sum: { cantidad: D(entradas) } }, { productoId: PROD, tipo: "salida", _sum: { cantidad: D(salidas) } }, { productoId: PROD, tipo: "ajuste", _sum: { cantidad: D(ajustes) } },
  ]
  const sinLote = entradas - salidas + ajustes - Object.values(lotes).reduce((a, b) => a + b, 0)
  return [...Object.entries(lotes).map(([id, n]) => ({ productoId: PROD, loteProductoId: id, tipo: "entrada", _sum: { cantidad: D(n) } })),
    { productoId: PROD, loteProductoId: null, tipo: "entrada", _sum: { cantidad: D(sinLote) } }]
}
const mov = (extra: object = {}) => ({ productoId: PROD, tipo: "salida", cantidad: 5, ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.producto.mockResolvedValue({ id: PROD, nombre: "Ivermectina", organizacionId: "o1", unidad: "ml", activo: true })
  m.movUnique.mockResolvedValue(null)
  m.groupBy.mockImplementation(async (q) => saldo(10)(q))
  m.lotes.mockResolvedValue([])
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
    // El alta con cantidad es la entrada al stock del lote
    expect(m.movCreate.mock.calls[0][0].data).toMatchObject({ productoId: PROD, loteProductoId: LOTE, tipo: "entrada", cantidad: 10 })
  })
})

describe("saldo, ajustes e idempotencia", () => {
  it("rechaza una salida mayor al stock", async () => {
    m.groupBy.mockImplementation(async (q) => saldo(10, 4, -2)(q)) // stock 4
    await expect(registrarMovimientoStock(ctx, mov({ cantidad: 5 }))).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/hay 4/) })
    await expect(registrarMovimientoStock(ctx, mov({ cantidad: 4 }))).resolves.toBeTruthy()
  })
  it("un ajuste que resta se guarda negativo y necesita motivo", async () => {
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar" }))).rejects.toThrow(/motivo/)
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste" , motivo: "recuento" }))).rejects.toThrow(/suma o resta/)
    await registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar", cantidad: 3, motivo: "Recuento" }))
    expect(m.movCreate.mock.calls[0][0].data).toMatchObject({ tipo: "ajuste" })
    expect(m.movCreate.mock.calls[0][0].data.cantidad.toNumber()).toBe(-3)
    m.groupBy.mockImplementation(async (q) => saldo(2)(q))
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "ajuste", sentido: "restar", cantidad: 3, motivo: "Recuento" }))).rejects.toMatchObject({ status: 409 })
  })
  it("una entrada no consulta saldo; el sentido solo vale en ajustes", async () => {
    await registrarMovimientoStock(ctx, mov({ tipo: "entrada", cantidad: 100 }))
    expect(m.groupBy).not.toHaveBeenCalled()
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "entrada", sentido: "sumar" }))).rejects.toThrow(/solo aplica/)
  })
  it("un reintento con la misma clave devuelve el original", async () => {
    const prior = { id: "m0", productoId: PROD, tipo: "salida", cantidad: D(5), loteProductoId: null, operacionId: null }
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

describe("lotes conectados al stock (FEFO)", () => {
  const L = (id: string, venc: string | null, saldo: number, vencido = false) => ({ id, vencimiento: venc ? new Date(venc) : null, createdAt: new Date("2026-01-01"), vencido, saldo: D(saldo) })
  it("reparte primero el lote vigente que vence antes, después sin lote y al final los vencidos", () => {
    const r = repartirFefo(12, [L("tarde", "2027-06-01", 10), L("pronto", "2026-12-01", 5), L("viejo", "2026-01-01", 20, true)], 4)
    expect(r!.map((a) => [a.loteProductoId, a.cantidad.toNumber()])).toEqual([["pronto", 5], ["tarde", 7]])
    const r2 = repartirFefo(19, [L("pronto", "2026-12-01", 5), L("viejo", "2026-01-01", 20, true)], 4)
    expect(r2!.map((a) => [a.loteProductoId, a.cantidad.toNumber()])).toEqual([["pronto", 5], [null, 4], ["viejo", 10]])
    expect(repartirFefo(50, [L("a", null, 5)], 1)).toBeNull()
  })
  it("una salida sin lote se guarda en varias filas con el mismo operacionId", async () => {
    m.groupBy.mockImplementation(async (q) => saldo(15, 0, 0, { [uuid(3)]: 5, [uuid(4)]: 10 })(q))
    m.lotes.mockResolvedValue([
      { id: uuid(3), vencimiento: new Date("2099-01-31T00:00:00Z"), createdAt: new Date() },
      { id: uuid(4), vencimiento: new Date("2098-01-31T00:00:00Z"), createdAt: new Date() },
    ])
    const r = await registrarMovimientoStock(ctx, mov({ cantidad: 12, clave: uuid(8) }))
    const filas = m.movCreate.mock.calls.map((c) => c[0].data)
    expect(filas.map((f) => [f.loteProductoId, f.cantidad.toNumber()])).toEqual([[uuid(4), 10], [uuid(3), 2]])
    expect(filas[0].operacionId).toBeTruthy(); expect(filas[1].operacionId).toBe(filas[0].operacionId)
    expect([filas[0].clave, filas[1].clave]).toEqual([uuid(8), null])
    expect(r.filas).toHaveLength(2)
  })
  it("con lote elegido controla el saldo de ese lote", async () => {
    m.lote.mockResolvedValue({ id: LOTE, nroLote: "A1", productoId: PROD })
    m.groupBy.mockImplementation(async (q) => saldo(10, 0, 0, { [LOTE]: 3 })(q))
    await expect(registrarMovimientoStock(ctx, mov({ cantidad: 5, loteProductoId: LOTE }))).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/A1 tiene 3 ml/) })
  })
  it("no se archiva un producto con stock ni se mueve uno archivado", async () => {
    await expect(configurarProducto(ctx, PROD, { activo: false })).rejects.toMatchObject({ status: 409 })
    m.groupBy.mockImplementation(async (q) => saldo(0)(q))
    m.prodUpdate.mockImplementation(async ({ data }) => ({ id: PROD, ...data }))
    await expect(configurarProducto(ctx, PROD, { activo: false, stockMinimo: "5", unidad: "dosis" })).resolves.toMatchObject({ activo: false, stockMinimo: 5, unidad: "dosis" })
    m.producto.mockResolvedValue({ id: PROD, nombre: "X", organizacionId: "o1", unidad: "ml", activo: false })
    await expect(registrarMovimientoStock(ctx, mov({ tipo: "entrada" }))).rejects.toThrow(/archivado/)
  })
})

describe("Fase C: edición, anulación y categorías", () => {
  const fila = (extra: object = {}) => ({ id: uuid(20), productoId: PROD, loteProductoId: null, sectorId: null, tipo: "salida", cantidad: D(4), operacionId: null, anulaAId: null, anuladoPor: null, ...extra })

  it("no permite dos productos con el mismo nombre en la organización", async () => {
    m.nombreDup.mockResolvedValueOnce({ id: "otro" })
    await expect(crearProducto(ctx, { nombre: "ivermectina", tipo: "antiparasitario" })).rejects.toMatchObject({ status: 409 })
    m.nombreDup.mockResolvedValueOnce({ id: "otro" })
    await expect(configurarProducto(ctx, PROD, { nombre: "Doramectina" })).rejects.toMatchObject({ status: 409 })
    m.prodCreate.mockImplementation(async ({ data }) => ({ id: "p", ...data }))
    await expect(crearProducto(ctx, { nombre: "Gasoil", tipo: "combustible", unidad: "litros", stockMinimo: "200" })).resolves.toMatchObject({ tipo: "combustible", unidad: "litros", stockMinimo: 200 })
  })

  it("vaciar el stock mínimo lo borra (no lo deja en 0)", () => {
    expect(productoConfigSchema.parse({ stockMinimo: "" }).stockMinimo).toBeNull()
    expect(productoConfigSchema.parse({ costoReferencia: "" }).costoReferencia).toBeNull()
    expect(productoConfigSchema.parse({}).stockMinimo).toBeUndefined()
    // Archivar o cambiar un campo no borra los demás
    expect(productoConfigSchema.parse({ activo: false })).toEqual({ activo: false })
    expect(productoConfigSchema.parse({ laboratorio: "" }).laboratorio).toBeNull()
  })

  it("anular una salida registra una entrada que la compensa y queda vinculada", async () => {
    m.movUnique.mockResolvedValueOnce(fila())
    const r = await anularMovimiento(ctx, uuid(20), { motivo: "cargado dos veces" })
    expect(r.anulados).toBe(1)
    const c = m.movCreate.mock.calls[0][0].data
    expect(c).toMatchObject({ tipo: "entrada", anulaAId: uuid(20), motivo: "Anulación: cargado dos veces" })
    expect(c.cantidad.toNumber()).toBe(4)
  })

  it("anular una entrada no puede dejar el stock negativo; un ajuste se compensa con signo contrario", async () => {
    m.groupBy.mockImplementation(async (q) => saldo(10, 8)(q)) // stock 2
    m.movUnique.mockResolvedValueOnce(fila({ tipo: "entrada", cantidad: D(5) }))
    await expect(anularMovimiento(ctx, uuid(20), { motivo: "error" })).rejects.toMatchObject({ status: 409 })
    m.groupBy.mockImplementation(async (q) => saldo(10)(q))
    m.movUnique.mockResolvedValueOnce(fila({ tipo: "ajuste", cantidad: D(-3) }))
    await anularMovimiento(ctx, uuid(20), { motivo: "recuento mal hecho" })
    expect(m.movCreate.mock.calls[0][0].data.cantidad.toNumber()).toBe(3)
  })

  it("no se anula dos veces, ni una anulación; una salida repartida se anula completa", async () => {
    m.movUnique.mockResolvedValueOnce(fila({ anuladoPor: { id: "x" } }))
    await expect(anularMovimiento(ctx, uuid(20), { motivo: "otra vez" })).rejects.toMatchObject({ status: 409 })
    m.movUnique.mockResolvedValueOnce(fila({ anulaAId: uuid(9) }))
    await expect(anularMovimiento(ctx, uuid(20), { motivo: "otra vez" })).rejects.toThrow(/Es una anulación/)
    await expect(anularMovimiento(ctx, uuid(20), { motivo: "" })).rejects.toThrow(/por qué/)
    m.movUnique.mockResolvedValueOnce(fila({ operacionId: "op" }))
    m.movMany.mockResolvedValueOnce([fila({ id: "a", operacionId: "op", loteProductoId: "L1", cantidad: D(10) }), fila({ id: "b", operacionId: "op", loteProductoId: "L2", cantidad: D(2) })])
    const r = await anularMovimiento(ctx, uuid(20), { motivo: "salida equivocada" })
    expect(r.anulados).toBe(2)
    const creadas = m.movCreate.mock.calls.map((c) => c[0].data)
    expect(creadas.map((c) => [c.anulaAId, c.loteProductoId, c.tipo])).toEqual([["a", "L1", "entrada"], ["b", "L2", "entrada"]])
    expect(creadas[0].operacionId).toBeTruthy(); expect(creadas[1].operacionId).toBe(creadas[0].operacionId)
  })

  it("editar un lote cambia sus datos, no la cantidad, y no duplica números", async () => {
    m.lote.mockResolvedValueOnce({ id: LOTE, nroLote: "A1", productoId: PROD }).mockResolvedValueOnce({ id: "otro" })
    await expect(actualizarLote(ctx, PROD, LOTE, { nroLote: "B2" })).rejects.toMatchObject({ status: 409 })
    m.lote.mockResolvedValueOnce({ id: LOTE, nroLote: "A1", productoId: PROD })
    m.loteUpdate.mockImplementation(async ({ data }) => ({ id: LOTE, ...data }))
    await actualizarLote(ctx, PROD, LOTE, { vencimiento: "2027-05-31", costo: "" })
    expect(m.loteUpdate.mock.calls[0][0].data).toEqual({ vencimiento: new Date("2027-05-31T00:00:00Z"), costo: null })
    await expect(actualizarLote(ctx, PROD, LOTE, { cantidad: 99 })).rejects.toThrow()
  })
})

describe("Fase C-2: galpones, transferencias y recuento", () => {
  const G1 = uuid(31), G2 = uuid(32)
  const ctxG = { ...ctx, establecimientoIdsConRol: () => ["e1"], organizacionDeEstablecimiento: { e1: "o1" } } as unknown as AuthContext
  // Saldo por ubicación: { [sectorId|"sin"]: cantidad } (sin lotes)
  const porUbic = (u: Record<string, number>) => async (q: { by: string[]; where: { sectorId?: string | null } }) => {
    const k = q.where.sectorId === undefined ? null : (q.where.sectorId ?? "sin")
    const total = k === null ? Object.values(u).reduce((a, b) => a + b, 0) : u[k] ?? 0
    return q.by.includes("loteProductoId") ? [{ productoId: PROD, loteProductoId: null, tipo: "entrada", _sum: { cantidad: D(total) } }] : [{ productoId: PROD, tipo: "entrada", _sum: { cantidad: D(total) } }]
  }
  beforeEach(() => { m.sector.mockImplementation(async ({ where }) => ({ id: where.id, nombre: where.id === G1 ? "Galpón 1" : "Galpón 2", establecimientoId: "e1" })) })

  it("una salida se controla contra el saldo del galpón elegido", async () => {
    m.groupBy.mockImplementation(porUbic({ [G1]: 3, sin: 50 }))
    await expect(registrarMovimientoStock(ctxG, mov({ cantidad: 5, sectorId: G1 }))).rejects.toThrow(/en Galpón 1: hay 3/)
    await registrarMovimientoStock(ctxG, mov({ cantidad: 5 }))
    expect(m.movCreate.mock.calls[0][0].data).toMatchObject({ sectorId: null })
  })

  it("un galpón de otra organización o sin permisos se rechaza", async () => {
    m.sector.mockResolvedValueOnce(null)
    await expect(registrarMovimientoStock(ctxG, mov({ tipo: "entrada", sectorId: G1 }))).rejects.toMatchObject({ status: 404 })
    m.sector.mockResolvedValueOnce({ id: G1, nombre: "Ajeno", establecimientoId: "eX" })
    await expect(registrarMovimientoStock(ctxG, mov({ tipo: "entrada", sectorId: G1 }))).rejects.toMatchObject({ status: 404 })
  })

  it("transferir: salida en origen + entrada en destino con el mismo operacionId; el total no cambia", async () => {
    m.groupBy.mockImplementation(porUbic({ sin: 20 }))
    const r = await transferirStock(ctxG, { productoId: PROD, desdeSectorId: null, haciaSectorId: G2, cantidad: 8, clave: uuid(40) })
    const [sal, ent] = m.movCreate.mock.calls.map((c) => c[0].data)
    expect(sal).toMatchObject({ tipo: "salida", concepto: "transferencia", sectorId: null, clave: uuid(40) })
    expect(ent).toMatchObject({ tipo: "entrada", concepto: "transferencia", sectorId: G2 })
    expect(sal.cantidad.toNumber()).toBe(8); expect(ent.cantidad.toNumber()).toBe(8)
    expect(sal.operacionId).toBe(ent.operacionId); expect(r.operacionId).toBe(sal.operacionId)
    await expect(transferirStock(ctxG, { productoId: PROD, desdeSectorId: G1, haciaSectorId: G1, cantidad: 1 })).rejects.toThrow(/distintos/)
    m.groupBy.mockImplementation(porUbic({ [G1]: 2 }))
    await expect(transferirStock(ctxG, { productoId: PROD, desdeSectorId: G1, haciaSectorId: G2, cantidad: 5 })).rejects.toMatchObject({ status: 409 })
  })

  it("recuento: ajusta solo las diferencias (faltante negativo, sobrante positivo) en una operación", async () => {
    const P2 = uuid(50)
    m.producto.mockImplementation(async ({ where }) => ({ id: where.id, nombre: where.id === PROD ? "Ivermectina" : "Vacuna", organizacionId: "o1", unidad: "dosis", activo: true }))
    m.groupBy.mockImplementation(async (q) => {
      const id = q.where.productoId.in[0]; const n = id === PROD ? 10 : 4
      return q.by.includes("loteProductoId") ? [{ productoId: id, loteProductoId: null, tipo: "entrada", _sum: { cantidad: D(n) } }] : [{ productoId: id, tipo: "entrada", _sum: { cantidad: D(n) } }]
    })
    const r = await registrarRecuento(ctxG, { sectorId: G1, clave: uuid(60), items: [{ productoId: PROD, contado: 7 }, { productoId: P2, contado: 4 }] })
    expect(r.ajustados).toBe(1)
    expect(r.items.map((i) => [i.sistema, i.contado, i.diferencia])).toEqual([[10, 7, -3], [4, 4, 0]])
    const aj = m.movCreate.mock.calls.map((c) => c[0].data)
    expect(aj).toHaveLength(1)
    expect(aj[0]).toMatchObject({ tipo: "ajuste", concepto: "recuento", sectorId: G1, productoId: PROD })
    expect(aj[0].cantidad.toNumber()).toBe(-3)
    // Reenviar el mismo recuento no lo duplica
    m.auditFirst.mockResolvedValueOnce({ detalle: { ajustados: 1 } })
    await expect(registrarRecuento(ctxG, { sectorId: G1, clave: uuid(60), items: [{ productoId: PROD, contado: 7 }] })).resolves.toMatchObject({ repetido: true })
    await expect(registrarRecuento(ctxG, { items: [{ productoId: PROD, contado: 1 }, { productoId: PROD, contado: 2 }] })).rejects.toThrow(/repetidos/)
  })
})
