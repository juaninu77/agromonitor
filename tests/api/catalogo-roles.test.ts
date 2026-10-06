import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ especie: vi.fn(), crearRaza: vi.fn(), ctx: {} as Record<string, unknown> }))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => (request: unknown) => handler(request, mocks.ctx),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { especie: { findFirst: mocks.especie }, raza: { create: mocks.crearRaza } },
}))
import { POST as routePOST } from "@/app/api/razas/route"
const POST = (body: object) =>
  routePOST(new NextRequest("http://localhost/api/razas", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  })
const especieId = "00000000-0000-4000-8000-000000000009"
beforeEach(() => {
  vi.resetAllMocks()
  mocks.ctx = {
    organizacionIds: ["orgAdmin", "orgOperario"],
    organizacionIdsConRol: (roles: string[]) => (roles.includes("admin") ? ["orgAdmin"] : []),
  }
  mocks.especie.mockResolvedValue({ id: especieId, organizacionId: null })
  mocks.crearRaza.mockResolvedValue({ id: "r1" })
})
describe("POST /api/razas: rol por organización", () => {
  it("rechaza crear en una organización donde el usuario es operario, aunque sea admin en otra", async () => {
    const res = await POST({ nombre: "Angus", especieId, organizacionId: "orgOperario" })
    expect(res.status).toBe(403)
    expect(mocks.crearRaza).not.toHaveBeenCalled()
  })
  it("sin organizacionId usa la única organización editable y acepta una especie global", async () => {
    const res = await POST({ nombre: "Angus", especieId })
    expect(res.status).toBe(201)
    expect(mocks.especie).toHaveBeenCalledWith({
      where: { id: especieId, OR: [{ organizacionId: { in: ["orgAdmin"] } }, { organizacionId: null }] },
    })
    expect(mocks.crearRaza).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizacionId: "orgAdmin" }) }))
  })
})
