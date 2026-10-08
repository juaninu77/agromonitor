import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  miMembresia: vi.fn(), membresiaFirst: vi.fn(), membresiaCount: vi.fn(), membresiaUpdate: vi.fn(), membresiaCreate: vi.fn(), membresiaDelete: vi.fn(),
  meDelete: vi.fn(), meCreate: vi.fn(), estCount: vi.fn(), estFind: vi.fn(),
  usuarioFirst: vi.fn(), usuarioCreate: vi.fn(), usuarioUnique: vi.fn(),
  invCreate: vi.fn(), invUpdateMany: vi.fn(), invUnique: vi.fn(), invUpdate: vi.fn(), invFirst: vi.fn(),
  notif: vi.fn(), audit: vi.fn(), correo: vi.fn(),
}))
vi.mock("@/lib/prisma", () => {
  const tx = {
    membresia: {
      findUnique: (q: { where: { usuarioId_organizacionId: { usuarioId: string } } }) => m.miMembresia(q.where.usuarioId_organizacionId.usuarioId),
      findFirst: m.membresiaFirst, count: m.membresiaCount, update: m.membresiaUpdate, create: m.membresiaCreate, delete: m.membresiaDelete,
    },
    membresiaEstablecimiento: { deleteMany: m.meDelete, createMany: m.meCreate },
    establecimiento: { count: m.estCount, findMany: m.estFind },
    usuario: { findFirst: m.usuarioFirst, create: m.usuarioCreate, findUnique: m.usuarioUnique },
    invitacion: { create: m.invCreate, updateMany: m.invUpdateMany, findUnique: m.invUnique, update: m.invUpdate, findFirst: m.invFirst },
    notificacion: { create: m.notif },
    auditLog: { create: m.audit },
  }
  return { prisma: { ...tx, $transaction: (cb: (t: unknown) => unknown) => cb(tx) } }
})
vi.mock("@/lib/email", () => ({ enviarCorreo: m.correo }))

import { aceptarInvitacion, aceptarInvitacionPorId, actualizarMiembro, hashToken, invitar, quitarMiembro, registrarConInvitacion } from "@/lib/equipo/service"
import { puedeGestionar } from "@/lib/equipo/roles"
import type { AuthContext } from "@/lib/api/with-auth"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ORG = "org-1", CAMPO_A = uuid(10), CAMPO_B = uuid(11)
const ctx = (userId = "yo") => ({ userId, organizacionIds: [ORG] } as unknown as AuthContext)
const TOKEN = "t".repeat(43)
const invitacion = (extra: object = {}) => ({
  id: "inv-1", organizacionId: ORG, email: "colega@campo.com", rol: "admin", accesoTotal: true, establecimientoIds: [], mensaje: null,
  estado: "pendiente", expiraAt: new Date(Date.now() + 86_400_000), invitadoPorId: "yo",
  organizacion: { id: ORG, nombre: "La Esperanza", esActivo: true }, invitadoPor: { nombre: "Juan", apellido: "I" }, ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
  m.correo.mockResolvedValue({ enviado: false })
  m.miMembresia.mockResolvedValue({ rol: "propietario" })
  m.membresiaCount.mockResolvedValue(1)
  m.estCount.mockImplementation(async ({ where }) => where.id.in.length)
  m.estFind.mockResolvedValue([])
  m.invCreate.mockImplementation(async ({ data }) => ({ id: "inv-1", ...data, organizacion: { nombre: "La Esperanza" }, invitadoPor: { nombre: "Juan", apellido: "I" } }))
  m.membresiaCreate.mockImplementation(async ({ data }) => ({ id: "mem-nueva", ...data }))
  m.usuarioCreate.mockImplementation(async ({ data }) => ({ id: "u-nuevo", ...data }))
})

describe("quién gestiona a quién", () => {
  it("propietarios todo; administradores no tocan a otros administradores ni nombran propietarios", () => {
    expect(puedeGestionar("propietario", "admin", "operario")).toBe(true)
    expect(puedeGestionar("propietario", null, "propietario")).toBe(true)
    expect(puedeGestionar("admin", null, "admin")).toBe(true)
    expect(puedeGestionar("admin", "encargado", "vet")).toBe(true)
    expect(puedeGestionar("admin", "admin", "operario")).toBe(false)
    expect(puedeGestionar("admin", "operario", "propietario")).toBe(false)
    expect(puedeGestionar("encargado", "operario", "vet")).toBe(false)
  })
})

describe("invitar", () => {
  it("genera un enlace con token cuyo hash es lo único que se guarda", async () => {
    m.usuarioFirst.mockResolvedValue(null)
    const r = await invitar(ctx(), ORG, { email: " Colega@Campo.com ", rol: "admin" }, "https://agro.test")
    const token = r.enlace.split("/invitacion/")[1]
    expect(r.enlace).toMatch(/^https:\/\/agro\.test\/invitacion\/[A-Za-z0-9_-]{43}$/)
    expect(m.invCreate.mock.calls[0][0].data).toMatchObject({ email: "colega@campo.com", rol: "admin", tokenHash: hashToken(token), invitadoPorId: "yo" })
    expect(JSON.stringify(m.invCreate.mock.calls[0][0].data)).not.toContain(token)
    expect(r.emailEnviado).toBe(false)
    expect(r.texto).toContain(r.enlace)
  })
  it("un encargado no invita; un administrador no invita propietarios", async () => {
    m.miMembresia.mockResolvedValue({ rol: "encargado" })
    await expect(invitar(ctx(), ORG, { email: "a@b.com", rol: "operario" }, "x")).rejects.toMatchObject({ status: 403 })
  })
  it("no invita a quien ya es miembro y valida los campos de acceso parcial", async () => {
    m.usuarioFirst.mockResolvedValue({ id: "u2" })
    m.miMembresia.mockImplementation(async (u: string) => (u === "yo" ? { rol: "admin" } : { rol: "operario" }))
    await expect(invitar(ctx(), ORG, { email: "a@b.com", rol: "operario" }, "x")).rejects.toMatchObject({ status: 409 })
    m.miMembresia.mockImplementation(async (u: string) => (u === "yo" ? { rol: "admin" } : null))
    await expect(invitar(ctx(), ORG, { email: "a@b.com", rol: "admin", accesoTotal: false, establecimientoIds: [CAMPO_A] }, "x")).rejects.toThrow(/todos los campos/)
    await expect(invitar(ctx(), ORG, { email: "a@b.com", rol: "operario", accesoTotal: false, establecimientoIds: [] }, "x")).rejects.toThrow(/al menos un campo/)
    m.estCount.mockResolvedValueOnce(0)
    await expect(invitar(ctx(), ORG, { email: "a@b.com", rol: "operario", accesoTotal: false, establecimientoIds: [uuid(99)] }, "x")).rejects.toThrow(/no pertenece/)
    // Con cuenta existente: aviso en la app SIN el enlace
    await invitar(ctx(), ORG, { email: "a@b.com", rol: "vet", accesoTotal: false, establecimientoIds: [CAMPO_A] }, "x")
    expect(m.notif.mock.calls[0][0].data.url).toBe("/configuracion/cuenta")
  })
})

describe("aceptar", () => {
  it("con sesión: solo la cuenta del email invitado; crea la membresía y marca la invitación", async () => {
    m.invUnique.mockResolvedValue(invitacion())
    await expect(aceptarInvitacion(TOKEN, { id: "u9", email: "otro@x.com" })).rejects.toMatchObject({ status: 403 })
    m.miMembresia.mockResolvedValue(null)
    await expect(aceptarInvitacion(TOKEN, { id: "u9", email: "COLEGA@campo.com" })).resolves.toMatchObject({ organizacionId: ORG })
    expect(m.membresiaCreate.mock.calls[0][0].data).toMatchObject({ usuarioId: "u9", organizacionId: ORG, rol: "admin", accesoTotal: true })
    expect(m.invUpdate.mock.calls[0][0].data).toMatchObject({ estado: "aceptada", aceptadaPorId: "u9" })
  })
  it("rechaza invitaciones vencidas, anuladas o usadas", async () => {
    m.invUnique.mockResolvedValueOnce(invitacion({ expiraAt: new Date(Date.now() - 1000) }))
    await expect(aceptarInvitacion(TOKEN, { id: "u9", email: "colega@campo.com" })).rejects.toMatchObject({ status: 410 })
    m.invUnique.mockResolvedValueOnce(invitacion({ estado: "revocada" }))
    await expect(aceptarInvitacion(TOKEN, { id: "u9", email: "colega@campo.com" })).rejects.toThrow(/anulada/)
    m.invUnique.mockResolvedValueOnce(null)
    await expect(aceptarInvitacion(TOKEN, { id: "u9", email: "colega@campo.com" })).rejects.toMatchObject({ status: 404 })
  })
  it("crear la cuenta desde la invitación no crea una organización propia", async () => {
    m.invUnique.mockResolvedValue(invitacion({ rol: "operario", accesoTotal: false, establecimientoIds: [CAMPO_B] }))
    m.usuarioFirst.mockResolvedValue(null)
    m.miMembresia.mockResolvedValue(null)
    m.estFind.mockResolvedValue([{ id: CAMPO_B }])
    await expect(registrarConInvitacion(TOKEN, { nombre: "Ana", apellido: "Gómez", password: "corta" })).rejects.toThrow()
    const r = await registrarConInvitacion(TOKEN, { nombre: "Ana", apellido: "Gómez", password: "Campo2026" })
    expect(r).toMatchObject({ email: "colega@campo.com", organizacionId: ORG })
    expect(m.usuarioCreate.mock.calls[0][0].data).toMatchObject({ email: "colega@campo.com", rol: "usuario" })
    expect(m.membresiaCreate.mock.calls[0][0].data).toMatchObject({ rol: "operario", accesoTotal: false })
    expect(m.meCreate.mock.calls[0][0].data).toEqual([{ membresiaId: "mem-nueva", establecimientoId: CAMPO_B }])
  })
  it("aceptar sin el enlace exige el email verificado", async () => {
    m.usuarioUnique.mockResolvedValue({ emailVerificado: null })
    await expect(aceptarInvitacionPorId("inv-1", { id: "u9", email: "colega@campo.com" })).rejects.toMatchObject({ status: 403 })
  })
})

describe("cambiar y quitar miembros", () => {
  const miembro = (rol: string, extra: object = {}) => ({ id: "mem-2", usuarioId: "u2", organizacionId: ORG, rol, esActivo: true, accesoTotal: true, establecimientosAcceso: [], ...extra })
  it("un administrador cambia a un operario, pero no a otro administrador", async () => {
    m.miMembresia.mockResolvedValue({ rol: "admin" })
    m.membresiaFirst.mockResolvedValueOnce(miembro("operario"))
    await expect(actualizarMiembro(ctx(), ORG, "mem-2", { rol: "encargado", accesoTotal: false, establecimientoIds: [CAMPO_A] })).resolves.toMatchObject({ rol: "encargado", establecimientoIds: [CAMPO_A] })
    m.membresiaFirst.mockResolvedValueOnce(miembro("admin"))
    await expect(actualizarMiembro(ctx(), ORG, "mem-2", { rol: "operario" })).rejects.toMatchObject({ status: 403 })
  })
  it("siempre queda al menos un propietario", async () => {
    m.membresiaFirst.mockResolvedValue(miembro("propietario"))
    m.membresiaCount.mockResolvedValue(0)
    await expect(actualizarMiembro(ctx(), ORG, "mem-2", { rol: "admin" })).rejects.toMatchObject({ status: 409 })
    await expect(quitarMiembro(ctx(), ORG, "mem-2")).rejects.toMatchObject({ status: 409 })
    m.membresiaCount.mockResolvedValue(1)
    await expect(quitarMiembro(ctx(), ORG, "mem-2")).resolves.toEqual({ id: "mem-2" })
  })
  it("nadie cambia su propio rol; cualquiera puede salir si no es el último propietario", async () => {
    m.membresiaFirst.mockResolvedValue(miembro("propietario", { usuarioId: "yo" }))
    await expect(actualizarMiembro(ctx(), ORG, "mem-2", { rol: "operario" })).rejects.toThrow(/propio rol/)
    m.miMembresia.mockResolvedValue({ rol: "operario" })
    m.membresiaFirst.mockResolvedValue(miembro("operario", { usuarioId: "yo" }))
    await expect(quitarMiembro(ctx(), ORG, "mem-2")).resolves.toEqual({ id: "mem-2" })
    m.membresiaFirst.mockResolvedValue(miembro("vet"))
    await expect(quitarMiembro(ctx(), ORG, "mem-2")).rejects.toMatchObject({ status: 403 })
  })
})
