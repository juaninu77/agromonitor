import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { costosAnthropic, costosMeta, limpiarCacheCostos } from "@/lib/whatsapp/costos"
import { costoEstimadoUsd } from "@/lib/whatsapp/precios"
import { rangoMetricas } from "@/lib/whatsapp/metricas"

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  limpiarCacheCostos()
  for (const k of ["ANTHROPIC_ADMIN_KEY", "ANTHROPIC_WORKSPACE_ID", "WHATSAPP_WABA_ID"]) delete process.env[k]
  process.env.WHATSAPP_TOKEN = "t"
})
afterEach(() => vi.restoreAllMocks())

describe("costo estimado por consulta", () => {
  it("usa los precios del modelo y, si no lo conoce, los del asistente", () => {
    const t = { entrada: 1_000_000, salida: 100_000, cacheLeidos: 2_000_000, cacheEscritos: 0 }
    expect(costoEstimadoUsd("claude-opus-5-5", t)).toBeCloseTo(4 + 2 + 0.4, 6)
    expect(costoEstimadoUsd("claude-sonnet-5-5", t)).toBeCloseTo(2 + 1 + 0.4, 6)
    expect(costoEstimadoUsd("modelo-nuevo", t)).toBeCloseTo(6.4, 6)
  })
  it("el período termina hoy (día de Argentina) e incluye los dos extremos", () => {
    expect(rangoMetricas(7, "2026-10-17")).toEqual({ desde: "2026-10-11", hasta: "2026-10-17" })
  })
})

describe("gasto real de Anthropic", () => {
  it("sin clave de administrador no consulta nada", async () => {
    const f = vi.fn()
    expect(await costosAnthropic("2026-10-01", "2026-10-17", f)).toMatchObject({ estado: "sin_configurar", totalUsd: 0 })
    expect(f).not.toHaveBeenCalled()
  })

  it("suma los centavos por modelo, tipo y día, recorre las páginas y filtra el espacio de trabajo", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "sk-ant-admin01-x"
    process.env.ANTHROPIC_WORKSPACE_ID = "wrk_agro"
    const fila = (amount: string, token_type: string, workspace_id: string | null = "wrk_agro") => ({ amount, model: "claude-opus-5-5", token_type, cost_type: "tokens", workspace_id })
    const f = vi.fn()
      .mockImplementationOnce(json(200, { data: [{ starting_at: "2026-10-16T00:00:00Z", results: [fila("120.5", "output_tokens"), fila("999", "output_tokens", null)] }], has_more: true, next_page: "p2" }))
      .mockImplementationOnce(json(200, { data: [{ starting_at: "2026-10-17T00:00:00Z", results: [fila("30", "cache_read_input_tokens")] }], has_more: false, next_page: null }))
    const r = await costosAnthropic("2026-10-16", "2026-10-17", f)
    expect(r.estado).toBe("ok")
    expect(r.totalUsd).toBeCloseTo(1.505, 6)
    expect(r.porTipo).toEqual([{ tipo: "Salida", usd: 1.205 }, { tipo: "Lectura de caché", usd: 0.3 }])
    expect(r.porDia.map((d) => d.dia)).toEqual(["2026-10-16", "2026-10-17"])
    const [url, init] = f.mock.calls[0]
    expect(url).toContain("/v1/organizations/cost_report?")
    expect(url).toContain("ending_at=2026-10-18T00%3A00%3A00.000Z")
    expect(init.headers).toMatchObject({ "x-api-key": "sk-ant-admin01-x", "anthropic-version": "2023-06-01" })
    expect(f.mock.calls[1][0]).toContain("page=p2")
    // La segunda consulta del mismo período sale de la caché
    await costosAnthropic("2026-10-16", "2026-10-17", f)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("un error de la API se informa y no queda en caché", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "sk-ant-api03-no-admin"
    const f = vi.fn(json(401, { error: { message: "invalid x-api-key" } }))
    expect(await costosAnthropic("2026-10-01", "2026-10-17", f)).toMatchObject({ estado: "error", mensaje: "invalid x-api-key" })
    await costosAnthropic("2026-10-01", "2026-10-17", f)
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe("gasto real de Meta", () => {
  it("sin la cuenta de WhatsApp Business no consulta nada", async () => {
    const f = vi.fn()
    expect((await costosMeta("2026-10-01", "2026-10-17", f)).estado).toBe("sin_configurar")
    expect(f).not.toHaveBeenCalled()
  })

  it("separa mensajes gratis y cobrados por categoría", async () => {
    process.env.WHATSAPP_WABA_ID = "1669"
    const f = vi.fn(json(200, {
      currency: "USD",
      pricing_analytics: { data: [{ data_points: [
        { start: 1, volume: 40, cost: 0, pricing_type: "FREE_CUSTOMER_SERVICE", pricing_category: "SERVICE" },
        { start: 1, volume: 5, cost: 0.11, pricing_type: "REGULAR", pricing_category: "UTILITY" },
      ] }] },
    }))
    const r = await costosMeta("2026-10-01", "2026-10-17", f)
    expect(r).toMatchObject({ estado: "ok", moneda: "USD", total: 0.11, mensajes: 45, mensajesGratis: 40 })
    expect(r.porCategoria[0]).toEqual({ categoria: "Servicio (respuestas)", mensajes: 40, costo: 0 })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(decodeURIComponent(url)).toContain("/1669?fields=currency,pricing_analytics.start(")
    expect(decodeURIComponent(url)).toContain("granularity(DAILY)")
    expect(init.headers).toMatchObject({ Authorization: "Bearer t" })
  })
})
