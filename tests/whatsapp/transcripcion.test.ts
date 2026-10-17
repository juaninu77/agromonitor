import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ producto: vi.fn(), lote: vi.fn(), sector: vi.fn(), categoria: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { producto: { findMany: m.producto }, lote: { findMany: m.lote }, sector: { findMany: m.sector }, categoria: { findMany: m.categoria } },
}))
import { costoTranscripcionUsd, transcribirAudio, vocabularioDelCampo } from "@/lib/whatsapp/transcripcion"

beforeEach(() => {
  vi.resetAllMocks()
  process.env.OPENAI_API_KEY = "sk-test"
  m.producto.mockResolvedValue([{ nombre: "Ivomec 1%" }])
  m.lote.mockResolvedValue([{ nombre: "Terneros 2026" }])
  m.sector.mockResolvedValue([{ nombre: "Potrero del Molino" }])
  m.categoria.mockResolvedValue([{ nombre: "Vaquillona" }, { nombre: "vaquillona" }])
})

describe("vocabulario", () => {
  it("usa los nombres del campo y de su organización, y respeta el largo máximo", async () => {
    const v = await vocabularioDelCampo("e1", "o1", 120)
    expect(m.lote.mock.calls[0][0].where).toMatchObject({ establecimientoId: "e1", activo: true })
    expect(m.sector.mock.calls[0][0].where).toMatchObject({ establecimientoId: "e1" })
    expect(m.producto.mock.calls[0][0].where).toEqual({ organizacionId: "o1", activo: true })
    expect(v).toMatch(/Terneros 2026, Potrero del Molino, Ivomec 1%, Vaquillona/)
    expect(v.length).toBeLessThanOrEqual(120)
  })
})

describe("transcripción", () => {
  it("manda el audio a OpenAI en español con el vocabulario y estima el costo", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: " vacuné 40 terneros ", usage: { type: "tokens", input_tokens: 600, output_tokens: 20, input_token_details: { audio_tokens: 500, text_tokens: 100 } } }), { status: 200 }))
    const r = await transcribirAudio(new Uint8Array([1, 2, 3]), "audio/ogg; codecs=opus", "Terneros", f)
    expect(r.texto).toBe("vacuné 40 terneros")
    // 500 audio × $6 + 100 texto × $2,50 + 20 salida × $10 por millón
    expect(r.costoUsd).toBeCloseTo(0.00345, 8)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions")
    expect(init.headers).toEqual({ Authorization: "Bearer sk-test" })
    const form = init.body as FormData
    expect(form.get("model")).toBe("gpt-4o-transcribe")
    expect(form.get("language")).toBe("es")
    expect(form.get("prompt")).toBe("Terneros")
    expect((form.get("file") as File).name).toBe("nota.ogg")
  })

  it("un error de OpenAI se informa con su mensaje", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid file format" } }), { status: 400 }))
    await expect(transcribirAudio(new Uint8Array([1]), "audio/ogg", "", f)).rejects.toThrow("Invalid file format")
  })

  it("si se cobra por duración, usa los segundos", () => {
    expect(costoTranscripcionUsd("gpt-4o-mini-transcribe", { type: "duration", seconds: 120 }, 0)).toBeCloseTo(0.006, 8)
  })
})
