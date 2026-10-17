import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ auth: vi.fn(), metricas: vi.fn(), anthropic: vi.fn(), meta: vi.fn() }))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (h: (r: unknown, c: unknown) => unknown) => async (r: unknown) => h(r, m.auth()),
}))
vi.mock("@/lib/whatsapp/metricas", () => ({ PERIODOS_METRICAS: [7, 30, 90], metricasWhatsapp: m.metricas }))
vi.mock("@/lib/whatsapp/costos", () => ({ costosAnthropic: m.anthropic, costosMeta: m.meta }))
import { NextRequest } from "next/server"
import { GET } from "@/app/api/whatsapp/metricas/route"

const pedir = (q = "") => GET(new NextRequest(`http://localhost/api/whatsapp/metricas${q}`), { params: Promise.resolve({}) } as never)

beforeEach(() => {
  vi.resetAllMocks()
  m.metricas.mockResolvedValue({ desde: "2026-09-18", hasta: "2026-10-17" })
  m.anthropic.mockResolvedValue({ estado: "sin_configurar" })
  m.meta.mockResolvedValue({ estado: "sin_configurar" })
})

describe("métricas del asistente", () => {
  it("solo las ve un administrador de la plataforma (no el admin de una organización)", async () => {
    m.auth.mockReturnValue({ esAdminPlataforma: false, userRole: "admin" })
    expect((await pedir()).status).toBe(403)
    expect(m.metricas).not.toHaveBeenCalled()
  })
  it("acepta solo los períodos previstos y consulta los costos del mismo rango", async () => {
    m.auth.mockReturnValue({ esAdminPlataforma: true })
    const r = await pedir("?dias=365")
    expect(r.status).toBe(200)
    expect(m.metricas).toHaveBeenCalledWith(30)
    expect(m.anthropic).toHaveBeenCalledWith("2026-09-18", "2026-10-17")
    expect((await r.json()).data.configuracion).toHaveProperty("modelo")
    await pedir("?dias=7")
    expect(m.metricas).toHaveBeenLastCalledWith(7)
  })
})
