import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ producto: vi.fn(), crear: vi.fn(), ctx: {} as Record<string, unknown> }))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, m.ctx) }))
vi.mock("@/lib/prisma", () => ({ prisma: { producto: { findFirst: m.producto }, sesionManga: { create: m.crear } } }))
vi.mock("@/lib/api/tenant", () => ({ loteDelTenant: async () => ({ id: "L1" }) }))
import { POST as routePOST } from "@/app/api/manga/route"

const EST = "00000000-0000-4000-8000-000000000001", PROD = "00000000-0000-4000-8000-000000000002"
const POST = (body: object) => routePOST(new NextRequest("http://localhost/api/manga", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({}) })
const base = { nombre: "Vacunación", fecha: "2026-10-10", tipo: "vacunacion", establecimientoId: EST, accionesHabilitadas: ["sanidad"] }
const conRol = (roles: string[]) => {
  m.ctx = { userId: "u1", establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" }, establecimientoIdsConRol: (r: string[]) => (r.some((x) => roles.includes(x)) ? [EST] : []) }
}

beforeEach(() => {
  vi.resetAllMocks()
  m.producto.mockResolvedValue({ tipo: "vacuna" })
  m.crear.mockImplementation(async ({ data }: { data: object }) => ({ id: "S1", ...data }))
})

describe("crear sesión de manga con tratamiento", () => {
  it("la sanidad necesita el producto y lo define admin/encargado/vet del campo", async () => {
    conRol(["vet"])
    const sinProducto = await POST(base)
    expect(sinProducto.status).toBe(400)
    expect((await sinProducto.json()).error).toMatch(/producto del tratamiento/)
    conRol(["operario"])
    expect((await POST({ ...base, productoSanidadId: PROD })).status).toBe(403)
    expect(m.crear).not.toHaveBeenCalled()
  })
  it("guarda producto, dosis, vía, motivo y carencia; solo productos sanitarios activos (de la org o generales)", async () => {
    conRol(["vet"])
    const r = await POST({ ...base, productoSanidadId: PROD, dosisSanidad: 2, viaSanidad: "subcutanea", carenciaSanidad: 21 })
    expect(r.status).toBe(201)
    expect(m.producto.mock.calls[0][0].where).toMatchObject({ id: PROD, activo: true, OR: [{ organizacionId: "o1" }, { organizacionId: null }] })
    expect(m.crear.mock.calls[0][0].data).toMatchObject({ productoSanidadId: PROD, dosisSanidad: 2, unidadSanidad: "ml", viaSanidad: "subcutanea", motivoSanidad: "preventivo", carenciaSanidad: 21 })
    m.producto.mockResolvedValue({ tipo: "alimento" })
    expect((await POST({ ...base, productoSanidadId: PROD })).status).toBe(404)
  })
  it("no acepta fechas futuras", async () => {
    conRol(["vet"])
    expect((await POST({ ...base, accionesHabilitadas: ["peso"], fecha: "2999-01-01" })).status).toBe(400)
  })
})
