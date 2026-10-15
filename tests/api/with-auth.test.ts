import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { membresia: { findMany: mocks.findMany } } }))
import { contextoDeUsuario, withAuth } from "@/lib/api/with-auth"
const context = { params: Promise.resolve({}) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "user", rol: "operario" } })
  mocks.findMany.mockResolvedValue([])
})

describe("withAuth", () => {
  it("convierte rechazos asíncronos en JSON 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const route = withAuth(async () => { await Promise.resolve(); throw new Error("database details") })
    const response = await route(new NextRequest("http://localhost/api/test"), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Error interno del servidor" })
    log.mockRestore()
  })
  it("no ejecuta el handler sin sesión", async () => {
    mocks.auth.mockResolvedValue(null)
    const handler = vi.fn(async () => NextResponse.json({ ok: true }))
    expect((await withAuth(handler)(new NextRequest("http://localhost"), context)).status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
  it("mantiene los permisos separados por organización", async () => {
    mocks.findMany.mockResolvedValue([
      { organizacionId: "org1", rol: "admin", organizacion: { establecimientos: [{ id: "est1" }] } },
      { organizacionId: "org2", rol: "operario", organizacion: { establecimientos: [{ id: "est2" }] } },
    ])
    const route = withAuth(async (_, ctx) => NextResponse.json(ctx.establecimientoIdsConRol(["admin"])))
    expect(await (await route(new NextRequest("http://localhost"), context)).json()).toEqual(["est1"])
  })

  it("arma el mismo contexto sin sesión web (canales como WhatsApp)", async () => {
    mocks.findMany.mockResolvedValue([
      { organizacionId: "org1", rol: "encargado", accesoTotal: false, establecimientosAcceso: [{ establecimientoId: "est2" }], organizacion: { establecimientos: [{ id: "est1" }, { id: "est2" }] } },
    ])
    const ctx = await contextoDeUsuario("user", "operario")
    expect(ctx.establecimientoIds).toEqual(["est2"])
    expect(ctx.establecimientoIdsConRol(["encargado"])).toEqual(["est2"])
    expect(ctx.esAdminPlataforma).toBe(false)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usuarioId: "user", esActivo: true }) }))
    expect((await contextoDeUsuario("user", "admin")).esAdminPlataforma).toBe(true)
  })
})
