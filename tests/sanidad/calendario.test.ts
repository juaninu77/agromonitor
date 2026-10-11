import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  protFindFirst: vi.fn(), estFindUnique: vi.fn(), loteFindFirst: vi.fn(), calFindFirst: vi.fn(), calCreate: vi.fn(), calUpdate: vi.fn(),
  tareaCreateMany: vi.fn(), tareaUpdateMany: vi.fn(), tareaFindFirst: vi.fn(), tareaUpdate: vi.fn(), audit: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    calendarioSanitario: { create: m.calCreate, update: m.calUpdate },
    tarea: { createMany: m.tareaCreateMany, updateMany: m.tareaUpdateMany, findFirst: m.tareaFindFirst, update: m.tareaUpdate },
    auditLog: { create: m.audit },
  }
  return {
    prisma: {
      protocoloSanitario: { findFirst: m.protFindFirst },
      establecimiento: { findUnique: m.estFindUnique },
      lote: { findFirst: m.loteFindFirst },
      calendarioSanitario: { findFirst: m.calFindFirst },
      $transaction: (cb: (t: unknown) => unknown) => cb(tx),
    },
  }
})
import { crearCalendario, cumplirTarea, desactivarCalendario } from "@/lib/sanidad/calendario"
import { alertaBrote, ultimosMeses } from "@/lib/sanidad/indicadores"
import { anclasNecesarias, proyectarItems } from "@/lib/sanidad/proyeccion"
import type { ItemPlan } from "@/lib/sanidad/plan"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const EST = uuid(1), PROT = uuid(2), LOTE = uuid(3), CAL = uuid(4), TAREA = uuid(5)
const vet = {
  userId: "u1", establecimientoIds: [EST], organizacionIds: ["o1"], organizacionDeEstablecimiento: { [EST]: "o1" },
  establecimientoIdsConRol: (r: string[]) => (r.includes("vet") ? [EST] : []),
} as unknown as AuthContext
const operario = { ...vet, establecimientoIdsConRol: () => [] } as unknown as AuthContext

const item = (extra: Partial<ItemPlan>): ItemPlan => ({
  id: uuid(100), nombre: "Ítem", momento: "inicio", mes: null, dia: null, diasOffset: 0, repetirCadaDias: null, destinatarios: null,
  productoTipo: null, productoId: null, dosis: null, unidad: null, via: null, esAftosa: false, obligatorio: true, notas: null, ...extra,
})

describe("proyección del protocolo al año", () => {
  it("ubica cada ítem por su ancla y desplazamiento, y ordena por fecha", () => {
    const r = proyectarItems([
      item({ id: "a", nombre: "Destete + 30", momento: "destete", diasOffset: 30 }),
      item({ id: "b", nombre: "Fecha fija", momento: "fecha", mes: 3, dia: 15 }),
      item({ id: "c", nombre: "Otoño − 7", momento: "campania_otono", diasOffset: -7, obligatorio: false }),
    ], { fechaInicio: "2026-01-01", fechaDestete: "2026-02-10", fechaCampaniaOtono: "2026-04-20" }, { anio: 2026, zona: null })
    expect(r.programadas.map((p) => [p.itemId, p.fecha, p.obligatorio])).toEqual([["a", "2026-03-12", true], ["b", "2026-03-15", true], ["c", "2026-04-13", false]])
    expect(r.omitidos).toEqual([])
  })
  it("repite cada N días hasta fin de año", () => {
    const r = proyectarItems([item({ nombre: "Perros", repetirCadaDias: 45 })], { fechaInicio: "2026-10-01" }, { anio: 2026, zona: null })
    expect(r.programadas.map((p) => [p.fecha, p.repeticion])).toEqual([["2026-10-01", 0], ["2026-11-15", 1], ["2026-12-30", 2]])
  })
  it("omite aftosa en zona libre sin vacunación, anclas faltantes, fechas imposibles y lo anterior al inicio", () => {
    const r = proyectarItems([
      item({ id: "af", nombre: "Aftosa", esAftosa: true }),
      item({ id: "sv", nombre: "Pre servicio", momento: "pre_servicio" }),
      item({ id: "f", nombre: "30 de febrero", momento: "fecha", mes: 2, dia: 30 }),
      item({ id: "p", nombre: "Enero", momento: "fecha", mes: 1, dia: 10 }),
    ], { fechaInicio: "2026-06-01" }, { anio: 2026, zona: "libre_sin_vacunacion" })
    expect(r.programadas).toEqual([])
    expect(Object.fromEntries(r.omitidos.map((o) => [o.itemId, o.motivo]))).toEqual({
      af: "Aftosa: el campo es zona libre sin vacunación",
      sv: "Falta la fecha de «Inicio del servicio»",
      f: "La fecha fija no existe en el año",
      p: "Ya pasó (anterior al inicio del calendario)",
    })
    // En zona con vacunación la aftosa sí se programa
    expect(proyectarItems([item({ esAftosa: true })], { fechaInicio: "2026-06-01" }, { anio: 2026, zona: "con_vacunacion" }).programadas).toHaveLength(1)
  })
  it("pide solo las anclas que usan los ítems", () => {
    expect(anclasNecesarias([item({ momento: "inicio" }), item({ momento: "destete" }), item({ momento: "destete" }), item({ momento: "fecha" })])).toEqual(["fechaDestete"])
  })
})

describe("crear calendario", () => {
  const protocolo = (items: object[], extra: object = {}) => ({ id: PROT, nombre: "Plan ZLSV", activo: true, zonaAplicable: null, items, ...extra })
  const pedido = (extra: object = {}) => ({ establecimientoId: EST, protocoloId: PROT, anio: 2026, fechaInicio: "2026-01-01", ...extra })
  beforeEach(() => {
    vi.resetAllMocks()
    m.estFindUnique.mockResolvedValue({ nombre: "La Esperanza", zonaAftosa: "libre_sin_vacunacion" })
    m.calCreate.mockImplementation(async ({ data }) => ({ id: CAL, ...data }))
    m.calFindFirst.mockResolvedValue(null)
  })

  it("solo admin, encargado o vet del campo", async () => {
    await expect(crearCalendario(operario, pedido())).rejects.toMatchObject({ status: 403 })
  })
  it("con aftosa exige la zona definida, y respeta la zona del protocolo", async () => {
    m.estFindUnique.mockResolvedValue({ nombre: "X", zonaAftosa: null })
    m.protFindFirst.mockResolvedValue(protocolo([item({ esAftosa: true })]))
    await expect(crearCalendario(vet, pedido())).rejects.toMatchObject({ status: 400, codigo: "zona_sin_definir" })
    m.estFindUnique.mockResolvedValue({ nombre: "X", zonaAftosa: "con_vacunacion" })
    m.protFindFirst.mockResolvedValue(protocolo([item({})], { zonaAplicable: "libre_sin_vacunacion" }))
    await expect(crearCalendario(vet, pedido())).rejects.toMatchObject({ status: 400, codigo: "zona_distinta" })
  })
  it("la vista previa no guarda nada", async () => {
    m.protFindFirst.mockResolvedValue(protocolo([item({ nombre: "Vacuna" }), item({ id: uuid(101), nombre: "Aftosa", esAftosa: true })]))
    const r = await crearCalendario(vet, pedido({ vistaPrevia: true }))
    expect(r).toMatchObject({ vistaPrevia: true, programadas: [{ nombre: "Vacuna", fecha: "2026-01-01" }], omitidos: [{ nombre: "Aftosa" }] })
    expect(m.calCreate).not.toHaveBeenCalled()
  })
  it("rechaza un calendario activo repetido", async () => {
    m.protFindFirst.mockResolvedValue(protocolo([item({})]))
    m.calFindFirst.mockResolvedValue({ id: CAL })
    await expect(crearCalendario(vet, pedido())).rejects.toMatchObject({ status: 409 })
  })
  it("crea el calendario y una tarea sanitaria por fecha, vinculadas al ítem", async () => {
    m.loteFindFirst.mockResolvedValue({ id: LOTE, nombre: "Vacas", activo: true })
    m.protFindFirst.mockResolvedValue(protocolo([
      item({ nombre: "Clostridiales", destinatarios: "Terneros", dosis: 5, unidad: "ml", via: "subcutanea", producto: { nombre: "Clostrisan" } } as Partial<ItemPlan>),
      item({ id: uuid(101), nombre: "Desparasitación", repetirCadaDias: 200, obligatorio: false }),
    ]))
    const r = await crearCalendario(vet, pedido({ loteId: LOTE }))
    expect(r).toMatchObject({ vistaPrevia: false, tareas: 3 })
    expect(m.calCreate.mock.calls[0][0].data).toMatchObject({ nombre: "Plan ZLSV 2026 · Vacas", anio: 2026, loteId: LOTE, fechaInicio: new Date("2026-01-01T00:00:00Z") })
    const tareas = m.tareaCreateMany.mock.calls[0][0].data
    expect(tareas.map((t: { titulo: string; prioridad: string; fechaLimite: Date }) => [t.titulo, t.prioridad, t.fechaLimite.toISOString()])).toEqual([
      ["Clostridiales", "alta", "2026-01-01T15:00:00.000Z"],
      ["Desparasitación", "media", "2026-01-01T15:00:00.000Z"],
      ["Desparasitación (2)", "media", "2026-07-20T15:00:00.000Z"],
    ])
    expect(tareas[0]).toMatchObject({ tipo: "sanitario", estado: "pendiente", establecimientoId: EST, calendarioSanitarioId: CAL, itemProtocoloId: uuid(100) })
    expect(tareas[0].descripcion).toBe("Grupo: Vacas\nA quiénes: Terneros\nProducto: Clostrisan\nDosis: 5 ml\nVía: subcutanea")
    expect(m.audit).toHaveBeenCalledOnce()
  })
})

describe("tareas del plan", () => {
  beforeEach(() => vi.resetAllMocks())
  it("cumplir una tarea la completa y devuelve el ítem; rechaza otra campo o cancelada", async () => {
    const tx = { tarea: { findFirst: m.tareaFindFirst, update: m.tareaUpdate } } as never
    m.tareaFindFirst.mockResolvedValue({ id: TAREA, estado: "pendiente", itemProtocoloId: uuid(100) })
    await expect(cumplirTarea(tx, TAREA, EST)).resolves.toEqual({ tareaId: TAREA, itemProtocoloId: uuid(100) })
    expect(m.tareaFindFirst.mock.calls[0][0].where).toEqual({ id: TAREA, establecimientoId: EST, tipo: "sanitario" })
    expect(m.tareaUpdate.mock.calls[0][0].data).toMatchObject({ estado: "completada" })
    // Ya completada (segunda aplicación de la misma tarea): no se vuelve a tocar
    m.tareaFindFirst.mockResolvedValue({ id: TAREA, estado: "completada", itemProtocoloId: null })
    await cumplirTarea(tx, TAREA, EST)
    expect(m.tareaUpdate).toHaveBeenCalledOnce()
    m.tareaFindFirst.mockResolvedValue({ id: TAREA, estado: "cancelada", itemProtocoloId: null })
    await expect(cumplirTarea(tx, TAREA, EST)).rejects.toMatchObject({ status: 400 })
    m.tareaFindFirst.mockResolvedValue(null)
    await expect(cumplirTarea(tx, TAREA, EST)).rejects.toMatchObject({ status: 400 })
  })
  it("desactivar cancela solo las tareas pendientes", async () => {
    m.calFindFirst.mockResolvedValue({ id: CAL, establecimientoId: EST, activo: true })
    m.tareaUpdateMany.mockResolvedValue({ count: 4 })
    await expect(desactivarCalendario(vet, CAL)).resolves.toEqual({ canceladas: 4 })
    expect(m.tareaUpdateMany.mock.calls[0][0]).toEqual({ where: { calendarioSanitarioId: CAL, estado: { in: ["pendiente", "en_progreso"] } }, data: { estado: "cancelada" } })
    m.calFindFirst.mockResolvedValue({ id: CAL, establecimientoId: EST, activo: false })
    await expect(desactivarCalendario(vet, CAL)).rejects.toMatchObject({ status: 409 })
    m.calFindFirst.mockResolvedValue({ id: CAL, establecimientoId: EST, activo: true })
    await expect(desactivarCalendario(operario, CAL)).rejects.toMatchObject({ status: 403 })
  })
})

describe("indicadores", () => {
  it("lista los últimos 12 meses cruzando el año", () => {
    const meses = ultimosMeses("2026-03-15")
    expect(meses).toHaveLength(12)
    expect([meses[0], meses[2], meses[11]]).toEqual(["2025-04", "2025-06", "2026-03"])
  })
  it("alerta de brote: al menos 3 casos y más del doble del promedio de los 3 meses previos", () => {
    const serie = (n: number[]) => n.map((casos, k) => ({ mes: `2026-0${k + 1}`, casos }))
    expect(alertaBrote(serie([1, 2, 1, 5]))).toEqual({ casos: 5, promedioPrevio: 1.3 })
    expect(alertaBrote(serie([0, 0, 0, 2]))).toBeNull()
    expect(alertaBrote(serie([3, 3, 3, 6]))).toBeNull()
    expect(alertaBrote(serie([5]))).toBeNull()
  })
})
