import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ guardar: vi.fn(), procesar: vi.fn(), after: vi.fn() }))
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: m.after }))
vi.mock("@/lib/whatsapp/procesar", () => ({ guardarEntrante: m.guardar, procesarMensaje: m.procesar }))
import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/whatsapp/webhook/route"

const SECRETO = "app-secret"
const cuerpo = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "PHONE" }, messages: [
    { from: "549111", id: "w1", timestamp: "1760000000", type: "text", text: { body: "hola" } },
    { from: "549111", id: "w2", timestamp: "1760000001", type: "text", text: { body: "¿stock?" } },
  ] } }] }],
})
const post = (body: string, firma?: string) => new NextRequest("http://localhost/api/whatsapp/webhook", { method: "POST", body, headers: firma ? { "x-hub-signature-256": firma } : {} })
const firmar = (b: string) => `sha256=${createHmac("sha256", SECRETO).update(b).digest("hex")}`

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "PHONE", WHATSAPP_APP_SECRET: SECRETO, WHATSAPP_VERIFY_TOKEN: "verificar" })
  m.after.mockImplementation(async (fn: () => Promise<void>) => fn())
})

describe("webhook de WhatsApp", () => {
  it("responde el desafío de verificación solo con el token correcto", async () => {
    const ok = await GET(new NextRequest("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificar&hub.challenge=123"))
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe("123")
    expect((await GET(new NextRequest("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=123"))).status).toBe(403)
  })

  it("rechaza cuerpos sin firma o con firma de otro secreto, y lo deja en los logs", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect((await POST(post(cuerpo))).status).toBe(401)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/WHATSAPP_APP_SECRET/))
    log.mockRestore()
    expect((await POST(post(cuerpo, `sha256=${createHmac("sha256", "x").update(cuerpo).digest("hex")}`))).status).toBe(401)
    expect(m.guardar).not.toHaveBeenCalled()
  })

  it("guarda los mensajes, responde 200 y procesa después solo los nuevos", async () => {
    m.guardar.mockResolvedValueOnce("id1").mockResolvedValueOnce(null)
    const r = await POST(post(cuerpo, firmar(cuerpo)))
    expect(r.status).toBe(200)
    expect(m.guardar).toHaveBeenCalledTimes(2)
    expect(m.after).toHaveBeenCalledTimes(1)
    expect(m.procesar.mock.calls).toEqual([["id1"]])
  })

  it("mensajes para otro número no se guardan y avisan en los logs", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {})
    const otro = cuerpo.replace('"PHONE"', '"OTRO"')
    const r = await POST(post(otro, firmar(otro)))
    expect(r.status).toBe(200)
    expect(m.guardar).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/OTRO.*WHATSAPP_PHONE_NUMBER_ID/))
    log.mockRestore()
  })

  it("sin configurar responde 503", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    delete process.env.WHATSAPP_APP_SECRET
    expect((await POST(post(cuerpo, firmar(cuerpo)))).status).toBe(503)
    log.mockRestore()
  })
})
