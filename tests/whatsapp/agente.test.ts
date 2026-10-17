import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  animalFindMany: vi.fn(), productoFindMany: vi.fn(), tareaFindMany: vi.fn(), queryRaw: vi.fn(),
  saldosPorProducto: vi.fn(), saldosPorLote: vi.fn(), resumenFinanzas: vi.fn(), estados: vi.fn(), retiros: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { animal: { findMany: m.animalFindMany }, producto: { findMany: m.productoFindMany }, tarea: { findMany: m.tareaFindMany }, $queryRaw: m.queryRaw },
}))
vi.mock("@/lib/inventario/stock", async (orig) => ({ ...(await orig<typeof import("@/lib/inventario/stock")>()), saldosPorProducto: m.saldosPorProducto, saldosPorLote: m.saldosPorLote }))
vi.mock("@/lib/finanzas/resumen", () => ({ resumenFinanzas: m.resumenFinanzas }))
vi.mock("@/lib/reproduccion/estado", () => ({ estadosReproductivos: m.estados }))
vi.mock("@/lib/sanidad/retiro", () => ({ retirosVigentes: m.retiros }))
import { Prisma } from "@prisma/client"
import type { AuthContext } from "@/lib/api/with-auth"
import { armarMensajes, responderConsulta } from "@/lib/whatsapp/agente"
import { herramientasConsulta } from "@/lib/whatsapp/herramientas/consultas"

const EST = "00000000-0000-4000-8000-000000000001"
const ctx = { userId: "u1", establecimientoIds: [EST], rolPorEstablecimiento: { [EST]: "encargado" } } as unknown as AuthContext
const herramientas = () => Object.fromEntries(herramientasConsulta({ ctx, establecimientoId: EST, organizacionId: "o1" }).map((t) => [t.definicion.name, t]))
const correr = async (nombre: string, input: unknown) => JSON.parse(await herramientas()[nombre].run(input as Record<string, unknown>))
const usage = (o: Record<string, number> = {}) => ({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0, ...o })

beforeEach(() => {
  vi.resetAllMocks()
  m.estados.mockResolvedValue(new Map())
  m.retiros.mockResolvedValue(new Map())
})

describe("mensajes para Claude", () => {
  it("el historial empieza por el usuario y el contexto del día va al final", () => {
    const msgs = armarMensajes({
      texto: "¿y las vaquillonas?", usuarioNombre: "Ana", campoNombre: "La Esperanza", rol: "encargado",
      historial: [{ rol: "assistant", texto: "suelto" }, { rol: "user", texto: "¿cuántas vacas hay?" }, { rol: "assistant", texto: "Hay 120." }],
    }, "2026-10-15")
    expect(msgs.map((x) => x.role)).toEqual(["user", "assistant", "user", "system"])
    expect(msgs[2].content).toBe("¿y las vaquillonas?")
    expect(msgs[3].content).toMatch(/Hoy es 2026-10-15.*Ana.*encargado.*La Esperanza/)
  })

  it("usa el modelo con caché del prompt y respaldo ante rechazos, ejecuta las herramientas y devuelve el texto final", async () => {
    m.queryRaw.mockResolvedValue([{ especie: "bovino", categoria: "Vaca", sexo: "F", cantidad: 120 }])
    const create = vi.fn()
      .mockResolvedValueOnce({ model: "claude-opus-5-5", usage: usage({ cache_read_input_tokens: 0, cache_creation_input_tokens: 4000 }), stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "resumen_rodeo", input: {} }, { type: "tool_use", id: "t2", name: "inventada", input: {} }] })
      .mockResolvedValueOnce({ model: "claude-opus-5-5", usage: usage(), stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Hay 120 vacas." }] })
    const client = { beta: { messages: { create } } } as never
    const r = await responderConsulta({ ctx, establecimientoId: EST, organizacionId: "o1", vinculoId: null, texto: "¿cuántas vacas?", historial: [], usuarioNombre: "Ana", campoNombre: "X", rol: "operario" }, client)
    expect(r.texto).toBe("Hay 120 vacas.")
    // Suma de las dos llamadas: 2000 entrada × $4 + 200 salida × $20 + 4000 escritura × $5 + 5000 lectura × $0,20 por millón
    expect(r.uso).toMatchObject({ modelo: "claude-opus-5-5", tokensEntrada: 2000, tokensSalida: 200, tokensCacheEscritos: 4000, tokensCacheLeidos: 5000, llamadasIa: 2, herramientas: ["resumen_rodeo", "inventada"] })
    expect(r.uso.costoUsd).toBeCloseTo(0.033, 6)
    const p = create.mock.calls[0][0]
    expect(p).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"], output_config: { effort: "low" } })
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" })
    expect(p.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["stock_insumos", "proponer_sanidad", "proponer_tactos"]))
    expect(r.borradores).toEqual([])
    // Los dos resultados vuelven juntos en un solo mensaje
    const segunda = create.mock.calls[1][0].messages
    const resultados = segunda.at(-1).content
    expect(resultados).toHaveLength(2)
    expect(JSON.parse(resultados[0].content)).toMatchObject({ total: 120 })
    expect(resultados[1]).toMatchObject({ tool_use_id: "t2", is_error: true })
  })

  it("si el modelo se niega, contesta con un mensaje amable", async () => {
    const client = { beta: { messages: { create: vi.fn().mockResolvedValue({ model: "claude-opus-5-5", usage: usage(), stop_reason: "refusal", content: [] }) } } } as never
    expect((await responderConsulta({ ctx, establecimientoId: EST, organizacionId: "o1", vinculoId: null, texto: "x", historial: [], usuarioNombre: "A", campoNombre: "X", rol: "operario" }, client)).texto).toMatch(/No puedo ayudarte/)
  })

  it("corta si la consulta da demasiadas vueltas", async () => {
    m.queryRaw.mockResolvedValue([])
    const create = vi.fn().mockResolvedValue({ model: "claude-opus-5-5", usage: usage(), stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "resumen_rodeo", input: {} }] })
    const client = { beta: { messages: { create } } } as never
    const r = await responderConsulta({ ctx, establecimientoId: EST, organizacionId: "o1", vinculoId: null, texto: "x", historial: [], usuarioNombre: "A", campoNombre: "X", rol: "operario" }, client)
    expect(r.texto).toMatch(/demasiados pasos/)
    expect(r.uso.llamadasIa).toBe(8)
    expect(create).toHaveBeenCalledTimes(8)
  })
})

describe("herramientas de consulta", () => {
  it("buscar_animal busca solo en el campo activo y normaliza el EID", async () => {
    m.animalFindMany.mockResolvedValue([])
    expect(await correr("buscar_animal", { identificador: " 982 000123456789 " })).toEqual({ encontrados: 0 })
    const where = m.animalFindMany.mock.calls[0][0].where
    expect(where.establecimientoId).toBe(EST)
    expect(where.OR).toContainEqual({ caravanaRfid: "982000123456789" })
  })

  it("stock_insumos busca en la organización del campo y marca el stock bajo", async () => {
    m.productoFindMany.mockResolvedValue([{ id: "p1", nombre: "Ivomec", tipo: "antiparasitario", unidad: "ml", stockMinimo: new Prisma.Decimal(500), lotes: [] }])
    m.saldosPorProducto.mockResolvedValue(new Map([["p1", new Prisma.Decimal(200)]]))
    m.saldosPorLote.mockResolvedValue({ porLote: new Map(), sinLote: new Map() })
    const r = await correr("stock_insumos", { buscar: "ivomec" })
    expect(m.productoFindMany.mock.calls[0][0].where).toMatchObject({ organizacionId: "o1", activo: true })
    expect(r.productos[0]).toMatchObject({ producto: "Ivomec", stock: 200, minimo: 500, stockBajo: true })
  })

  it("tareas_pendientes filtra por el campo y, si se pide, por el usuario", async () => {
    m.tareaFindMany.mockResolvedValue([])
    await correr("tareas_pendientes", { soloMias: true })
    expect(m.tareaFindMany.mock.calls[0][0].where).toMatchObject({ establecimientoId: EST, asignadoAId: "u1" })
  })

  it("un error de permisos vuelve como texto para que el asistente lo explique", async () => {
    m.resumenFinanzas.mockRejectedValue(Object.assign(new Error("No tenés permisos"), { status: 403 }))
    expect(await correr("finanzas_resumen", {})).toEqual({ error: expect.stringMatching(/no tiene permiso/) })
    expect(m.resumenFinanzas.mock.calls[0][1]).toMatchObject({ establecimientoId: EST })
  })

  it("un error inesperado no expone detalles", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    m.queryRaw.mockRejectedValue(new Error("connection string secreta"))
    expect(await correr("resumen_rodeo", {})).toEqual({ error: "No se pudo consultar ahora." })
    log.mockRestore()
  })
})
