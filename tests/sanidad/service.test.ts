import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animal: vi.fn(), lote: vi.fn(), producto: vi.fn(), loteProducto: vi.fn(), crear: vi.fn(), audit: vi.fn(), descontar: vi.fn(),
  findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), productos: vi.fn(), animales: vi.fn(),
  prodUnique: vi.fn(), lotesCosto: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  txFindMany: vi.fn(), sector: vi.fn(), revertir: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    evtSanidad: { create: m.crear, createMany: m.createMany, findMany: m.txFindMany, updateMany: m.updateMany, update: m.update },
    auditLog: { create: m.audit },
    producto: { findUnique: m.prodUnique },
    loteProducto: { findMany: m.lotesCosto },
  }
  return {
    prisma: {
      animal: { findFirst: m.animal, findMany: m.animales },
      lote: { findFirst: m.lote },
      producto: { findFirst: m.producto, findMany: m.productos },
      loteProducto: { findFirst: m.loteProducto },
      evtSanidad: { findMany: m.findMany, count: m.count, groupBy: m.groupBy, aggregate: m.aggregate, findFirst: m.findFirst },
      sector: { findFirst: m.sector },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
vi.mock("@/lib/inventario/aplicaciones", () => ({ descontarAplicacion: m.descontar, revertirAplicaciones: m.revertir }))
import { Prisma } from "@prisma/client"
import { anularSanidad, aplicarMasivo, contarDestino, costoAplicacion, editarSanidad, listarSanidad, registrarSanidad, resumenSanidad } from "@/lib/sanidad/service"
import { registroSanitarioSchema } from "@/lib/sanidad/validation"
import { hoyArgentina } from "@/lib/inventario/fechas"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ANIMAL = uuid(1), LOTE = uuid(2), PROD = uuid(3), EST1 = uuid(10), EST2 = uuid(11), AJENO = uuid(12)
// EST1: el usuario es vet (puede registrar) · EST2: operario (solo ve)
const ctx = {
  userId: "u1", establecimientoIds: [EST1, EST2], organizacionIds: ["o1"],
  organizacionDeEstablecimiento: { [EST1]: "o1", [EST2]: "o1" },
  // vet en EST1 (registra y edita); admin/encargado en ninguno salvo que el test lo cambie
  establecimientoIdsConRol: (r: string[]) => (r.includes("vet") ? [EST1] : []),
} as unknown as AuthContext
const base = (extra: object = {}) => ({ animalId: ANIMAL, productoId: PROD, fecha: "2026-01-15", ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  m.animal.mockResolvedValue({ id: ANIMAL, caravanaVisual: "A-1", estadoVital: "activo", establecimientoId: EST1 })
  m.producto.mockResolvedValue({ id: PROD, activo: true, organizacionId: "o1" })
  m.crear.mockImplementation(async ({ data }) => ({ id: "E1", ...data, costo: null, animal: null, producto: { id: PROD }, loteProducto: null, lote: null }))
  m.descontar.mockResolvedValue({ descontado: 5, faltante: 0, unidad: "ml", ubicacion: null, lotes: [{ loteProductoId: "L1", cantidad: 5 }] })
  m.prodUnique.mockResolvedValue({ costoReferencia: null, monedaCosto: "ARS" })
  m.lotesCosto.mockResolvedValue([{ id: "L1", costo: new Prisma.Decimal(120), moneda: "ARS" }])
  m.revertir.mockResolvedValue({ revertido: 5, productoIds: [PROD] })
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
    const r = await registrarSanidad(ctx, base({ descontarStock: "5", motivo: "preventivo", veterinario: "Dra. Paz", carenciaDias: "21" }))
    const data = m.crear.mock.calls[0][0].data
    // Costo calculado del lote (5 ml × 120) y lote tomado de lo descontado
    expect(data).toMatchObject({ animalId: ANIMAL, loteId: null, productoId: PROD, motivo: "preventivo", fecha: new Date("2026-01-15T00:00:00Z"), costo: 600, loteProductoId: "L1", veterinario: "Dra. Paz", carenciaDias: 21 })
    // La salida de stock queda vinculada al id del evento
    expect(m.descontar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cantidad: 5, origenTipo: "sanidad", origenId: data.id }), expect.objectContaining({ estricto: true, establecimientoId: EST1 }))
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ tabla: "evt_sanidad", rowPk: data.id, organizacionId: "o1" })
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

describe("costo de la aplicación", () => {
  it("usa el costo de cada lote o el de referencia, y no mezcla monedas", async () => {
    const tx = { producto: { findUnique: m.prodUnique }, loteProducto: { findMany: m.lotesCosto } } as unknown as Prisma.TransactionClient
    m.prodUnique.mockResolvedValue({ costoReferencia: new Prisma.Decimal(100), monedaCosto: "ARS" })
    m.lotesCosto.mockResolvedValue([{ id: "L1", costo: new Prisma.Decimal(120), moneda: "ARS" }, { id: "L2", costo: null, moneda: "ARS" }])
    expect(await costoAplicacion(tx, PROD, [{ loteProductoId: "L1", cantidad: 2 }, { loteProductoId: "L2", cantidad: 1 }, { loteProductoId: null, cantidad: 0.5 }])).toBe(390)
    m.lotesCosto.mockResolvedValue([{ id: "L1", costo: new Prisma.Decimal(3), moneda: "USD" }])
    expect(await costoAplicacion(tx, PROD, [{ loteProductoId: "L1", cantidad: 2 }])).toBeNull()
    expect(await costoAplicacion(tx, PROD, [])).toBeNull()
  })
})

describe("aplicación masiva", () => {
  const masiva = (extra: object = {}) => ({ clave: uuid(50), destino: { establecimientoId: EST1, loteId: LOTE }, productoId: PROD, fecha: "2026-01-15", dosis: 5, unidad: "ml", descontarPorAnimal: 5, animalesEsperados: 3, ...extra })
  beforeEach(() => {
    m.count.mockResolvedValue(0)
    m.lote.mockResolvedValue({ id: LOTE })
    m.animales.mockResolvedValue([{ id: "a1" }, { id: "a2" }, { id: "a3" }])
    m.descontar.mockResolvedValue({ descontado: 15, faltante: 0, unidad: "ml", ubicacion: null, lotes: [{ loteProductoId: "L1", cantidad: 15 }] })
  })
  it("registra un evento por animal y un único descuento por el total", async () => {
    const r = await aplicarMasivo(ctx, masiva())
    expect(m.descontar).toHaveBeenCalledTimes(1)
    expect(m.descontar.mock.calls[0][1]).toMatchObject({ cantidad: 15, origenId: uuid(50), origenTipo: "sanidad" })
    const filas = m.createMany.mock.calls[0][0].data
    expect(filas).toHaveLength(3)
    // 15 ml × 120 = 1800, repartido entre 3
    expect(filas[0]).toMatchObject({ animalId: "a1", operacionId: uuid(50), costo: 600, loteProductoId: "L1" })
    // Solo animales activos del campo, en el grupo hoy
    expect(m.animales.mock.calls[0][0].where).toMatchObject({ establecimientoId: EST1, estadoVital: "activo", loteHist: { some: { loteId: LOTE, hasta: null } } })
    expect(r).toMatchObject({ cantidad: 3, repetido: false })
  })
  it("un reintento con la misma clave no duplica", async () => {
    m.count.mockResolvedValue(3)
    await expect(aplicarMasivo(ctx, masiva())).resolves.toMatchObject({ repetido: true, cantidad: 3 })
    expect(m.createMany).not.toHaveBeenCalled()
  })
  it("si cambió la cantidad de animales pide confirmar de nuevo", async () => {
    await expect(aplicarMasivo(ctx, masiva({ animalesEsperados: 5 }))).rejects.toMatchObject({ status: 409, codigo: "destino_cambio" })
    m.animales.mockResolvedValue([])
    await expect(aplicarMasivo(ctx, masiva())).rejects.toThrow(/No hay animales/)
  })
  it("solo con rol sanitario en el campo, y filtros del mismo campo", async () => {
    await expect(aplicarMasivo(ctx, masiva({ destino: { establecimientoId: EST2 } }))).rejects.toMatchObject({ status: 403 })
    m.lote.mockResolvedValue(null)
    await expect(aplicarMasivo(ctx, masiva())).rejects.toMatchObject({ status: 404 })
    await expect(contarDestino(ctx, { establecimientoId: AJENO })).rejects.toMatchObject({ status: 404 })
  })
  it("la vista previa cuenta con los filtros de especie, categoría y potrero", async () => {
    m.sector.mockResolvedValue({ id: uuid(60) })
    await expect(contarDestino(ctx, { establecimientoId: EST2, especie: "Ovino", categoriaId: uuid(61), sectorId: uuid(60) })).resolves.toMatchObject({ cantidad: 3 })
    expect(m.animales.mock.calls[0][0].where).toMatchObject({ especie: { nombre: { equals: "ovino" } }, categoriaId: uuid(61), ubicacionHist: { some: { sectorId: uuid(60), hasta: null } } })
  })
})

describe("anular y editar", () => {
  const gestor = { ...ctx, establecimientoIdsConRol: () => [EST1] } as unknown as AuthContext
  const evento = (extra: object = {}) => ({ id: "E1", operacionId: null, anuladoAt: null, observ: null, veterinario: null, aplicador: null, via: null, motivo: null, animal: { establecimientoId: EST1 }, lote: null, ...extra })
  beforeEach(() => { m.updateMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length })) })
  it("anula con motivo, devuelve el stock y audita; un vet no puede anular", async () => {
    m.findFirst.mockResolvedValue(evento())
    await expect(anularSanidad(ctx, "E1", { motivo: "animal equivocado" })).rejects.toMatchObject({ status: 403 })
    const r = await anularSanidad(gestor, "E1", { motivo: "animal equivocado" })
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["E1"] } }, data: { anuladoPorId: "u1", motivoAnulacion: "animal equivocado" } })
    expect(m.revertir).toHaveBeenCalledWith(expect.anything(), ["E1"], "animal equivocado")
    expect(r).toMatchObject({ anulados: 1, masiva: false, stockDevuelto: 5 })
    await expect(anularSanidad(gestor, "E1", { motivo: "x" })).rejects.toThrow(/por qué/)
  })
  it("un tratamiento de una masiva anula toda la aplicación", async () => {
    m.findFirst.mockResolvedValue(evento({ operacionId: uuid(50) }))
    m.txFindMany.mockResolvedValue([{ id: "E1" }, { id: "E2" }, { id: "E3" }])
    const r = await anularSanidad(gestor, "E1", { motivo: "dosis equivocada" })
    expect(r).toMatchObject({ anulados: 3, masiva: true })
    expect(m.revertir).toHaveBeenCalledWith(expect.anything(), [uuid(50)], "dosis equivocada")
  })
  it("no se anula dos veces ni se edita un anulado", async () => {
    m.findFirst.mockResolvedValue(evento({ anuladoAt: new Date() }))
    await expect(anularSanidad(gestor, "E1", { motivo: "otra vez" })).rejects.toMatchObject({ status: 409 })
    await expect(editarSanidad(ctx, "E1", { observ: "x" })).rejects.toMatchObject({ status: 409 })
  })
  it("edita solo los datos enviados y audita antes/después", async () => {
    m.findFirst.mockResolvedValue(evento({ observ: "vieja", veterinario: "Dr. A" }))
    m.update.mockImplementation(async ({ data }) => ({ ...evento(), ...data, fecha: new Date("2026-01-15T00:00:00Z"), costo: null }))
    await editarSanidad(ctx, "E1", { observ: "nueva" })
    expect(m.update.mock.calls[0][0].data).toEqual({ observ: "nueva" })
    expect(m.audit.mock.calls[0][0].data.detalle).toEqual({ antes: { observ: "vieja" }, despues: { observ: "nueva" } })
    await expect(editarSanidad(ctx, "E1", {})).rejects.toThrow(/No hay cambios/)
    m.findFirst.mockResolvedValue(evento({ animal: { establecimientoId: EST2 } }))
    await expect(editarSanidad(ctx, "E1", { observ: "x" })).rejects.toMatchObject({ status: 403 })
  })
  it("el historial oculta los anulados salvo que se pidan", async () => {
    m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0)
    await listarSanidad(ctx, { establecimientoId: EST1 })
    expect(JSON.stringify(m.findMany.mock.calls[0][0].where)).toContain('"anuladoAt":null')
    await listarSanidad(ctx, { establecimientoId: EST1, anulados: "1", especie: "Ovino" })
    const w = JSON.stringify(m.findMany.mock.calls[1][0].where)
    expect(w).not.toContain('"anuladoAt":null')
    expect(w).toContain('"equals":"ovino"')
  })
})
