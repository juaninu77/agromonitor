import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(),
  estFind: vi.fn(), membFind: vi.fn(), notifFind: vi.fn(), notifCreateMany: vi.fn(), notifCreate: vi.fn(),
  usuarioFind: vi.fn(), vincFind: vi.fn(), msgCount: vi.fn(), msgCreate: vi.fn(),
  aplicarMasivo: vi.fn(), contarDestino: vi.fn(), registrarBaja: vi.fn(), audit: vi.fn(), enviarTexto: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsappBorrador: { updateMany: m.updateMany, findFirst: m.findFirst, update: m.update, create: m.create },
    establecimiento: { findUnique: m.estFind },
    membresia: { findMany: m.membFind },
    notificacion: { findMany: m.notifFind, createMany: m.notifCreateMany, create: m.notifCreate },
    usuario: { findUnique: m.usuarioFind },
    whatsappVinculo: { findUnique: m.vincFind },
    whatsappMensaje: { count: m.msgCount, create: m.msgCreate },
  },
}))
vi.mock("@/lib/sanidad/service", async (orig) => ({ ...(await orig<typeof import("@/lib/sanidad/service")>()), aplicarMasivo: m.aplicarMasivo, contarDestino: m.contarDestino }))
vi.mock("@/lib/ganado/baja", async (orig) => ({ ...(await orig<typeof import("@/lib/ganado/baja")>()), registrarBaja: m.registrarBaja }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: m.audit }))
vi.mock("@/lib/whatsapp/cliente", () => ({ enviarTexto: m.enviarTexto }))
import type { AuthContext } from "@/lib/api/with-auth"
import { InventarioError } from "@/lib/inventario/service"
import { SanidadError } from "@/lib/sanidad/service"
import { BajaError } from "@/lib/ganado/baja"
import { aprobarBorrador, cancelarBorrador, confirmarBorrador, rechazarBorrador, validadoresDelCampo } from "@/lib/whatsapp/borradores"

const EST = "00000000-0000-4000-8000-000000000001", OTRO = "00000000-0000-4000-8000-000000000002"
const ID = "00000000-0000-4000-8000-0000000000b1"
const ctx = (rol: string, campos = [EST]) => ({
  userId: "u-" + rol, establecimientoIds: campos, organizacionIds: ["o1"],
  rolPorEstablecimiento: Object.fromEntries(campos.map((c) => [c, rol])),
  organizacionDeEstablecimiento: Object.fromEntries(campos.map((c) => [c, "o1"])),
  establecimientoIdsConRol: (roles: string[]) => (roles.includes(rol) ? campos : []),
}) as unknown as AuthContext
const borrador = (o: Record<string, unknown> = {}) => ({
  id: ID, vinculoId: "v1", usuarioId: "u-autor", establecimientoId: EST, accion: "sanidad", estado: "procesando",
  payload: { clave: ID, destino: { establecimientoId: EST, loteId: "l1" }, productoId: "p1", animalesEsperados: 40 },
  resumen: "💉 *Sanidad* · 17/10\n• Producto: Ivomec", ...o,
})
const ultimoUpdate = () => m.update.mock.calls.at(-1)?.[0]

beforeEach(() => {
  vi.resetAllMocks()
  m.updateMany.mockResolvedValue({ count: 1 })
  m.findFirst.mockResolvedValue(borrador())
  m.aplicarMasivo.mockResolvedValue({ operacionId: ID, cantidad: 40, stock: null, repetido: false })
  m.estFind.mockResolvedValue({ organizacionId: "o1", nombre: "La Esperanza" })
  m.membFind.mockResolvedValue([{ usuarioId: "u-enc" }])
  m.notifFind.mockResolvedValue([])
  m.usuarioFind.mockResolvedValue({ nombre: "Juan", apellido: "Pérez" })
  m.vincFind.mockResolvedValue(null)
})

describe("confirmar desde WhatsApp", () => {
  it("con rol suficiente se aplica con el servicio real y queda auditado", async () => {
    const r = await confirmarBorrador(ctx("vet"), "v1", ID)
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: ID, vinculoId: "v1", estado: "pendiente" }, data: { estado: "procesando" } })
    expect(m.aplicarMasivo).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-vet" }), expect.objectContaining({ clave: ID }))
    expect(r).toEqual({ tipo: "aplicado", texto: "✅ Sanidad registrada a 40 animales." })
    expect(ultimoUpdate().data).toMatchObject({ estado: "aplicado" })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ tabla: "whatsapp_borradores", rowPk: ID, detalle: expect.objectContaining({ autorId: "u-autor", estado: "aplicado" }) }))
  })

  it("un operario no lo aplica: queda por validar 7 días y se avisa a los encargados del campo", async () => {
    const r = await confirmarBorrador(ctx("operario"), "v1", ID)
    expect(r.tipo).toBe("por_validar")
    expect(m.aplicarMasivo).not.toHaveBeenCalled()
    const data = m.update.mock.calls[0][0].data
    expect(data.estado).toBe("por_validar")
    expect(data.expira.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000)
    expect(m.notifCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ usuarioId: "u-enc", tipo: "whatsapp_validar", url: "/whatsapp", mensaje: expect.stringMatching(/Juan Pérez.*sanidad.*La Esperanza/) })] })
  })

  it("no se avisa dos veces a quien ya tiene la notificación sin leer", async () => {
    m.notifFind.mockResolvedValue([{ usuarioId: "u-enc" }])
    await confirmarBorrador(ctx("operario"), "v1", ID)
    expect(m.notifCreateMany).not.toHaveBeenCalled()
  })

  it("un doble toque no ejecuta dos veces", async () => {
    m.updateMany.mockResolvedValue({ count: 0 })
    m.findFirst.mockResolvedValue(borrador({ estado: "aplicado" }))
    expect(await confirmarBorrador(ctx("vet"), "v1", ID)).toEqual({ tipo: "nada", texto: "Eso ya quedó registrado." })
    expect(m.aplicarMasivo).not.toHaveBeenCalled()
  })

  it("un borrador vencido no se ejecuta", async () => {
    m.updateMany.mockResolvedValue({ count: 0 })
    m.findFirst.mockResolvedValue(borrador({ estado: "pendiente" }))
    expect((await confirmarBorrador(ctx("vet"), "v1", ID)).texto).toMatch(/venció/)
    expect(ultimoUpdate()).toEqual({ where: { id: ID }, data: { estado: "vencido" } })
  })

  it("sin acceso al campo del borrador no se aplica", async () => {
    const r = await confirmarBorrador(ctx("vet", [OTRO]), "v1", ID)
    expect(r.tipo).toBe("error")
    expect(m.aplicarMasivo).not.toHaveBeenCalled()
  })

  it("un lote vencido vuelve a preguntar y el segundo «Confirmar» lo acepta", async () => {
    m.aplicarMasivo.mockRejectedValue(new InventarioError("El lote 123 está vencido", 409, "lote_vencido"))
    const r = await confirmarBorrador(ctx("vet"), "v1", ID)
    expect(r.tipo).toBe("confirmar")
    expect(r.texto).toMatch(/vencido[\s\S]*¿Lo registro igual/)
    expect(ultimoUpdate().data).toMatchObject({ estado: "pendiente", payload: expect.objectContaining({ aceptarVencido: true }) })
  })

  it("sin stock ofrece registrar sin descontar", async () => {
    m.aplicarMasivo.mockRejectedValue(new InventarioError("Stock insuficiente", 409))
    const r = await confirmarBorrador(ctx("vet"), "v1", ID)
    expect(r.texto).toMatch(/SIN descontar/)
    expect(ultimoUpdate().data.payload).toMatchObject({ descontarPorAnimal: null })
  })

  it("si cambió la cantidad de animales, se recuenta y se pregunta de nuevo", async () => {
    m.aplicarMasivo.mockRejectedValue(new SanidadError("Ahora son 42 animales (antes 40)", 409, "destino_cambio"))
    m.contarDestino.mockResolvedValue({ cantidad: 42, excede: false })
    const r = await confirmarBorrador(ctx("vet"), "v1", ID)
    expect(r.tipo).toBe("confirmar")
    expect(ultimoUpdate().data.payload).toMatchObject({ animalesEsperados: 42 })
  })

  it("una faena bajo retiro no se puede aceptar: queda en error", async () => {
    m.findFirst.mockResolvedValue(borrador({ accion: "baja", payload: { animalId: "00000000-0000-4000-8000-0000000000a1", motivo: "faena", fecha: "2026-10-17" } }))
    m.registrarBaja.mockRejectedValue(new BajaError("Está bajo retiro hasta el 20/10", 409, "bajo_retiro"))
    const r = await confirmarBorrador(ctx("encargado"), "v1", ID)
    expect(r).toEqual({ tipo: "error", texto: "❌ No se pudo registrar: Está bajo retiro hasta el 20/10" })
    expect(ultimoUpdate().data).toMatchObject({ estado: "error" })
  })

  it("un error interno devuelve el borrador a pendiente para reintentar", async () => {
    m.aplicarMasivo.mockRejectedValue(new Error("conexión"))
    await expect(confirmarBorrador(ctx("vet"), "v1", ID)).rejects.toThrow("conexión")
    expect(ultimoUpdate()).toEqual({ where: { id: ID }, data: { estado: "pendiente" } })
  })

  it("cancelar solo afecta a los pendientes de ese número", async () => {
    await cancelarBorrador("v1", ID)
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: ID, vinculoId: "v1", estado: "pendiente" }, data: { estado: "cancelado" } })
  })
})

describe("validación por el encargado del campo", () => {
  beforeEach(() => m.findFirst.mockResolvedValue(borrador({ estado: "procesando" })))

  it("aprobar solo busca en los campos donde es admin o encargado y aplica con sus permisos", async () => {
    const r = await aprobarBorrador(ctx("encargado"), ID)
    expect(m.updateMany.mock.calls[0][0].where).toMatchObject({ id: ID, estado: "por_validar", establecimientoId: { in: [EST] } })
    expect(m.aplicarMasivo).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-encargado" }), expect.anything())
    expect(r.tipo).toBe("aplicado")
    expect(ultimoUpdate().data).toMatchObject({ estado: "aplicado", validadoPorId: "u-encargado" })
    expect(m.notifCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ usuarioId: "u-autor", tipo: "whatsapp_resultado", mensaje: expect.stringMatching(/fue aprobada/) }) })
  })

  it("un veterinario u operario no valida", async () => {
    m.findFirst.mockResolvedValue(null)
    await expect(aprobarBorrador(ctx("vet"), ID)).rejects.toMatchObject({ status: 404 })
    expect(m.updateMany.mock.calls[0][0].where.establecimientoId).toEqual({ in: [] })
    expect(m.aplicarMasivo).not.toHaveBeenCalled()
  })

  it("algo ya revisado no se aprueba dos veces", async () => {
    m.updateMany.mockResolvedValue({ count: 0 })
    m.findFirst.mockResolvedValue(borrador({ estado: "aplicado" }))
    await expect(aprobarBorrador(ctx("encargado"), ID)).rejects.toMatchObject({ status: 409 })
    expect(m.aplicarMasivo).not.toHaveBeenCalled()
  })

  it("si hay que aceptar un aviso, vuelve a por validar con el ajuste para aprobar de nuevo", async () => {
    m.aplicarMasivo.mockRejectedValue(new InventarioError("Lote vencido", 409, "lote_vencido"))
    const r = await aprobarBorrador(ctx("encargado"), ID)
    expect(r.tipo).toBe("confirmar")
    expect(ultimoUpdate().data).toMatchObject({ estado: "por_validar", payload: expect.objectContaining({ aceptarVencido: true }) })
    expect(m.notifCreate).not.toHaveBeenCalled()
  })

  it("rechazar guarda el motivo, audita y le avisa al autor por WhatsApp si escribió en las últimas 24 h", async () => {
    m.vincFind.mockResolvedValue({ id: "v1", waId: "549111" })
    m.msgCount.mockResolvedValue(1)
    m.enviarTexto.mockResolvedValue("wout")
    await rechazarBorrador(ctx("encargado"), ID, "La dosis está mal")
    expect(ultimoUpdate().data).toMatchObject({ estado: "rechazado", motivoRechazo: "La dosis está mal", validadoPorId: "u-encargado" })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ detalle: expect.objectContaining({ estado: "rechazado", motivo: "La dosis está mal" }) }))
    expect(m.enviarTexto).toHaveBeenCalledWith("549111", expect.stringMatching(/Sanidad · 17\/10.*rechazada.*La dosis está mal/))
  })

  it("fuera de las 24 h solo queda la notificación en la app", async () => {
    m.vincFind.mockResolvedValue({ id: "v1", waId: "549111" })
    m.msgCount.mockResolvedValue(0)
    await rechazarBorrador(ctx("encargado"), ID, "No corresponde")
    expect(m.notifCreate).toHaveBeenCalled()
    expect(m.enviarTexto).not.toHaveBeenCalled()
  })

  it("los validadores son admin/encargado activos de la organización con acceso a ese campo", async () => {
    await validadoresDelCampo(EST)
    const where = m.membFind.mock.calls[0][0].where
    expect(where).toMatchObject({ organizacionId: "o1", esActivo: true, rol: { in: ["propietario", "admin", "administrador", "encargado"] } })
    expect(where.OR).toContainEqual({ establecimientosAcceso: { some: { establecimientoId: EST } } })
  })
})
