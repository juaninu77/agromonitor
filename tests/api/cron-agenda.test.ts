import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const m = vi.hoisted(() => ({ campos: vi.fn(), sync: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { establecimiento: { findMany: m.campos } } }))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarTareasReproductivas: m.sync }))
import { GET } from "@/app/api/cron/agenda-reproductiva/route"

const pedido = (auth?: string) => new NextRequest("http://localhost/api/cron/agenda-reproductiva", { headers: auth ? { authorization: auth } : {} })

describe("cron de la agenda reproductiva", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.campos.mockResolvedValue([{ id: "E1" }, { id: "E2" }])
    m.sync.mockResolvedValue({ creadas: 2, cumplidas: 1 })
  })
  afterEach(() => { delete process.env.CRON_SECRET })
  it("no corre sin CRON_SECRET ni con otro secreto", async () => {
    expect((await GET(pedido("Bearer x"))).status).toBe(503)
    process.env.CRON_SECRET = "secreto-de-prueba"
    expect((await GET(pedido())).status).toBe(401)
    expect((await GET(pedido("Bearer otro"))).status).toBe(401)
    expect(m.sync).not.toHaveBeenCalled()
  })
  it("con el secreto pone al día todos los campos", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba"
    const r = await GET(pedido("Bearer secreto-de-prueba"))
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ campos: 2, creadas: 4, cumplidas: 2 })
    expect(m.sync.mock.calls.map((c) => c[0])).toEqual(["E1", "E2"])
  })
})
