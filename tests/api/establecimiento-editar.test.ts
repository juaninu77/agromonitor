import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ buscar: vi.fn(), actualizar: vi.fn(), audit: vi.fn(), ctx: {} as Record<string, unknown> }))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, m.ctx) }))
vi.mock("@/lib/prisma", () => ({ prisma: { establecimiento: { findFirst: m.buscar, update: m.actualizar } } }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: m.audit }))
import { PATCH as routePATCH } from "@/app/api/organizaciones/[organizacionId]/establecimientos/[establecimientoId]/route"

const PATCH = (org: string, body: object) =>
  routePATCH(new NextRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({}) })
const conParams = (org: string) => { m.ctx = { ...m.ctx, params: { organizacionId: org, establecimientoId: "E1" } } }

beforeEach(() => {
  vi.resetAllMocks()
  m.ctx = { userId: "u1", organizacionIdsConRol: (r: string[]) => (r.includes("admin") ? ["orgAdmin"] : []) }
  m.buscar.mockResolvedValue({ id: "E1" })
  m.actualizar.mockImplementation(async ({ data }: { data: object }) => ({ id: "E1", ...data }))
})

describe("PATCH establecimiento", () => {
  it("edita (no crea) y no toca los campos ausentes; vacío = sin dato", async () => {
    conParams("orgAdmin")
    const r = await PATCH("orgAdmin", { localidad: "Tandil", hectareas: null, renspa: "" })
    expect(r.status).toBe(200)
    expect(m.buscar).toHaveBeenCalledWith({ where: { id: "E1", organizacionId: "orgAdmin" }, select: { id: true } })
    expect(m.actualizar).toHaveBeenCalledWith({ where: { id: "E1" }, data: { localidad: "Tandil", hectareas: null, renspa: null } })
    expect(m.audit).toHaveBeenCalledOnce()
  })
  it("solo el administrador de esa organización; valida hectáreas; 404 si no es de la organización", async () => {
    conParams("orgOperario")
    expect((await PATCH("orgOperario", { nombre: "X" })).status).toBe(403)
    conParams("orgAdmin")
    expect((await PATCH("orgAdmin", { hectareas: -5 })).status).toBe(400)
    expect((await PATCH("orgAdmin", {})).status).toBe(400)
    m.buscar.mockResolvedValue(null)
    expect((await PATCH("orgAdmin", { nombre: "X" })).status).toBe(404)
    expect(m.actualizar).not.toHaveBeenCalled()
  })
})
