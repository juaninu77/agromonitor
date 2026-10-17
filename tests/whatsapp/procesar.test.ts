import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  msgFind: vi.fn(), msgUpdate: vi.fn(), msgCreate: vi.fn(), msgCount: vi.fn(), msgFindMany: vi.fn(), msgCreateMany: vi.fn(),
  vincFind: vi.fn(), vincUpdate: vi.fn(), estFindMany: vi.fn(),
  enviarTexto: vi.fn(), enviarLista: vi.fn(), marcarLeido: vi.fn(),
  responder: vi.fn(), contexto: vi.fn(), vincular: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsappMensaje: { findUnique: m.msgFind, update: m.msgUpdate, create: m.msgCreate, count: m.msgCount, findMany: m.msgFindMany, createMany: m.msgCreateMany },
    whatsappVinculo: { findUnique: m.vincFind, update: m.vincUpdate },
    establecimiento: { findMany: m.estFindMany },
  },
}))
vi.mock("@/lib/whatsapp/cliente", () => ({ enviarTexto: m.enviarTexto, enviarLista: m.enviarLista, marcarLeido: m.marcarLeido }))
vi.mock("@/lib/whatsapp/agente", () => ({ responderConsulta: m.responder }))
vi.mock("@/lib/api/with-auth", () => ({ contextoDeUsuario: m.contexto }))
vi.mock("@/lib/whatsapp/vinculo", async (orig) => ({ ...(await orig<typeof import("@/lib/whatsapp/vinculo")>()), vincularNumero: m.vincular }))
import { guardarEntrante, procesarMensaje, TEXTO_SIN_VINCULAR } from "@/lib/whatsapp/procesar"

const EST1 = "00000000-0000-4000-8000-000000000001", EST2 = "00000000-0000-4000-8000-000000000002"
const mensaje = (o: Record<string, unknown> = {}) => ({ id: "m1", wamid: "w1", waId: "549111", sentido: "entrante", tipo: "texto", texto: "¿cuánta ivermectina queda?", respuestaId: null, estado: "recibido", createdAt: new Date(), ...o })
const vinculo = (o: Record<string, unknown> = {}) => ({ id: "v1", establecimientoActivoId: EST1, usuario: { id: "u1", nombre: "Ana", rol: "operario", esActivo: true }, ...o })
const ctx = (campos: string[]) => ({
  userId: "u1", establecimientoIds: campos, organizacionDeEstablecimiento: Object.fromEntries(campos.map((c) => [c, "o1"])),
  rolPorEstablecimiento: Object.fromEntries(campos.map((c) => [c, "encargado"])),
})
const textosEnviados = () => m.enviarTexto.mock.calls.map((c) => c[1] as string)
const estadoFinal = () => m.msgUpdate.mock.calls.at(-1)?.[0].data.estado

beforeEach(() => {
  vi.resetAllMocks()
  process.env.ANTHROPIC_API_KEY = "test"
  m.msgFind.mockResolvedValue(mensaje())
  m.msgCount.mockResolvedValue(1)
  m.msgFindMany.mockResolvedValue([])
  m.vincFind.mockResolvedValue(vinculo())
  m.contexto.mockResolvedValue(ctx([EST1]))
  m.estFindMany.mockResolvedValue([{ id: EST1, nombre: "La Esperanza" }])
  m.enviarTexto.mockResolvedValue("wout")
  m.responder.mockResolvedValue({ texto: "Quedan *12 frascos* de Ivomec.", uso: { modelo: "claude-opus-5-5", tokensEntrada: 900, tokensSalida: 120, tokensCacheLeidos: 6000, tokensCacheEscritos: 0, llamadasIa: 2, herramientas: ["stock_insumos"], costoUsd: 0.0072 } })
})

describe("guardar el mensaje entrante", () => {
  it("un reintento de Meta con el mismo wamid no se procesa dos veces", async () => {
    m.msgCreateMany.mockResolvedValue({ count: 0 })
    expect(await guardarEntrante({ wamid: "w1", waId: "549111", nombre: null, tipo: "texto", texto: "hola", respuestaId: null, mediaId: null, fecha: new Date() })).toBeNull()
    expect(m.msgCreateMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true })
  })
  it("un mensaje ya procesado no se vuelve a responder", async () => {
    m.msgFind.mockResolvedValue(mensaje({ estado: "procesado" }))
    await procesarMensaje("m1")
    expect(m.enviarTexto).not.toHaveBeenCalled()
  })
})

describe("número sin vincular", () => {
  it("explica cómo vincularlo y no consulta nada", async () => {
    m.vincFind.mockResolvedValue(null)
    await procesarMensaje("m1")
    expect(textosEnviados()).toEqual([TEXTO_SIN_VINCULAR])
    expect(m.contexto).not.toHaveBeenCalled()
    expect(m.responder).not.toHaveBeenCalled()
  })
  it("deja de contestar si insiste", async () => {
    m.vincFind.mockResolvedValue(null)
    m.msgCount.mockResolvedValue(5)
    await procesarMensaje("m1")
    expect(m.enviarTexto).not.toHaveBeenCalled()
    expect(estadoFinal()).toBe("ignorado")
  })
  it("un usuario dado de baja es como un número sin vincular", async () => {
    m.vincFind.mockResolvedValue(vinculo({ usuario: { id: "u1", nombre: "Ana", rol: "operario", esActivo: false } }))
    await procesarMensaje("m1")
    expect(textosEnviados()).toEqual([TEXTO_SIN_VINCULAR])
  })
})

describe("vincular con el código", () => {
  it("vincula y saluda", async () => {
    m.msgFind.mockResolvedValue(mensaje({ texto: "VINCULAR K7Q2MZ" }))
    m.vincular.mockResolvedValue({ ok: true, usuarioId: "u1", vinculoId: "v1", nombre: "Ana", reemplazado: false })
    await procesarMensaje("m1")
    expect(m.vincular).toHaveBeenCalledWith("549111", "K7Q2MZ")
    expect(textosEnviados()[0]).toMatch(/Listo, Ana/)
    expect(m.responder).not.toHaveBeenCalled()
  })
  it("un código vencido avisa", async () => {
    m.msgFind.mockResolvedValue(mensaje({ texto: "vincular k7q2mz" }))
    m.vincular.mockResolvedValue({ ok: false })
    await procesarMensaje("m1")
    expect(textosEnviados()[0]).toMatch(/no es válido o ya venció/)
  })
  it("demasiados intentos se ignoran sin probar el código", async () => {
    m.msgFind.mockResolvedValue(mensaje({ texto: "VINCULAR AAAAAA" }))
    m.msgCount.mockResolvedValue(20)
    await procesarMensaje("m1")
    expect(m.vincular).not.toHaveBeenCalled()
    expect(estadoFinal()).toBe("ignorado")
  })
})

describe("campo activo", () => {
  it("con varios campos y ninguno elegido, pregunta con una lista", async () => {
    m.vincFind.mockResolvedValue(vinculo({ establecimientoActivoId: null }))
    m.contexto.mockResolvedValue(ctx([EST1, EST2]))
    m.estFindMany.mockResolvedValue([{ id: EST1, nombre: "La Esperanza" }, { id: EST2, nombre: "El Molino" }])
    await procesarMensaje("m1")
    expect(m.enviarLista).toHaveBeenCalledWith("549111", expect.stringMatching(/más de un campo/), "Elegir campo", [
      { id: `campo:${EST1}`, titulo: "La Esperanza" }, { id: `campo:${EST2}`, titulo: "El Molino" },
    ])
    expect(m.responder).not.toHaveBeenCalled()
  })
  it("elegir de la lista guarda el campo; uno ajeno se ignora", async () => {
    m.contexto.mockResolvedValue(ctx([EST1, EST2]))
    m.estFindMany.mockResolvedValue([{ id: EST1, nombre: "La Esperanza" }, { id: EST2, nombre: "El Molino" }])
    m.msgFind.mockResolvedValue(mensaje({ tipo: "lista", texto: "El Molino", respuestaId: `campo:${EST2}` }))
    await procesarMensaje("m1")
    expect(m.vincUpdate).toHaveBeenCalledWith({ where: { id: "v1" }, data: { establecimientoActivoId: EST2 } })
    m.vincUpdate.mockClear()
    m.msgFind.mockResolvedValue(mensaje({ tipo: "lista", texto: "Ajeno", respuestaId: "campo:00000000-0000-4000-8000-0000000000ff" }))
    await procesarMensaje("m1")
    expect(m.vincUpdate).not.toHaveBeenCalled()
  })
  it("un campo activo que ya no tiene acceso no se usa", async () => {
    m.vincFind.mockResolvedValue(vinculo({ establecimientoActivoId: EST2 }))
    await procesarMensaje("m1")
    // Con un solo campo accesible se toma ese
    expect(m.vincUpdate).toHaveBeenCalledWith({ where: { id: "v1" }, data: { establecimientoActivoId: EST1 } })
    expect(m.responder.mock.calls[0][0]).toMatchObject({ establecimientoId: EST1 })
  })
  it("sin campos activos avisa", async () => {
    m.contexto.mockResolvedValue(ctx([]))
    await procesarMensaje("m1")
    expect(textosEnviados()[0]).toMatch(/no tiene campos activos/)
  })
})

describe("consultas", () => {
  it("responde con el asistente, con los permisos del usuario y el historial", async () => {
    m.msgFindMany.mockResolvedValue([{ sentido: "saliente", texto: "¡Hola!" }, { sentido: "entrante", texto: "hola" }])
    await procesarMensaje("m1")
    expect(m.contexto).toHaveBeenCalledWith("u1", "operario")
    expect(m.marcarLeido).toHaveBeenCalledWith("w1")
    expect(m.responder).toHaveBeenCalledWith(expect.objectContaining({
      establecimientoId: EST1, organizacionId: "o1", texto: "¿cuánta ivermectina queda?", campoNombre: "La Esperanza", rol: "encargado",
      historial: [{ rol: "user", texto: "hola" }, { rol: "assistant", texto: "¡Hola!" }],
    }))
    expect(textosEnviados()).toEqual(["Quedan *12 frascos* de Ivomec."])
    // El consumo queda en el mensaje entrante, con el campo de la consulta
    expect(m.msgUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: expect.objectContaining({ establecimientoId: EST1, modelo: "claude-opus-5-5", tokensCacheLeidos: 6000, costoUsd: "0.007200", herramientas: ["stock_insumos"], duracionMs: expect.any(Number) }) })
    expect(m.msgCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ sentido: "saliente", wamid: "wout", vinculoId: "v1" }) })
    expect(estadoFinal()).toBe("procesado")
  })
  it("pasado el límite de mensajes avisa una vez y después ignora", async () => {
    m.msgCount.mockResolvedValue(31)
    await procesarMensaje("m1")
    expect(textosEnviados()[0]).toMatch(/muchos mensajes/)
    m.enviarTexto.mockClear()
    m.msgCount.mockResolvedValue(32)
    await procesarMensaje("m1")
    expect(m.enviarTexto).not.toHaveBeenCalled()
    expect(m.responder).not.toHaveBeenCalled()
  })
  it("fotos y audios todavía no se procesan", async () => {
    m.msgFind.mockResolvedValue(mensaje({ tipo: "audio", texto: null, mediaId: "M1" }))
    await procesarMensaje("m1")
    expect(textosEnviados()[0]).toMatch(/solo mensajes de texto/)
    expect(m.responder).not.toHaveBeenCalled()
  })
  it("sin la clave de Anthropic avisa en lugar de fallar", async () => {
    delete process.env.ANTHROPIC_API_KEY
    await procesarMensaje("m1")
    expect(textosEnviados()[0]).toMatch(/no está configurado/)
    expect(estadoFinal()).toBe("error")
  })
  it("si el asistente falla, guarda el error y le avisa a la persona", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    m.responder.mockRejectedValue(new Error("timeout"))
    await procesarMensaje("m1")
    expect(m.msgUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: { estado: "error", error: "timeout" } })
    expect(textosEnviados().at(-1)).toMatch(/Tuve un problema/)
    log.mockRestore()
  })
})
