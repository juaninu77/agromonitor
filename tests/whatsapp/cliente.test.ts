import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { descargarMedia, enviarTexto, WhatsappError } from "@/lib/whatsapp/cliente"

const respuesta = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const destinos = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => JSON.parse(c[1].body).to)

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "PHONE" })
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("envío por la Graph API", () => {
  it("un celular argentino rechazado por la lista de permitidos se reintenta sin el 9", async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(400, { error: { message: "Recipient phone number not in allowed list", code: 131030 } }))
      .mockResolvedValueOnce(respuesta(200, { messages: [{ id: "wout" }] }))
    expect(await enviarTexto("5492974624095", "hola")).toBe("wout")
    expect(destinos(fetchMock)).toEqual(["5492974624095", "542974624095"])
  })

  it("otros errores no se reintentan y guardan el código de Meta", async () => {
    fetchMock.mockImplementation(async () => respuesta(401, { error: { message: "Authorization Error", code: 0 } }))
    await expect(enviarTexto("5492974624095", "hola")).rejects.toThrow(WhatsappError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockImplementation(async () => respuesta(400, { error: { message: "Recipient phone number not in allowed list", code: 131030 } }))
    await expect(enviarTexto("5491100000000", "hola")).rejects.toThrow(/131030/)
    // Un número que no es un celular argentino no se toca
    fetchMock.mockClear()
    await expect(enviarTexto("15551234567", "hola")).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("descarga de archivos", () => {
  it("pide la URL temporal y baja los bytes con el token", async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { url: "https://lookaside.fbsbx.com/x", mime_type: "audio/ogg; codecs=opus", file_size: 3 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
    const r = await descargarMedia("M1", 1000)
    expect(Array.from(r.bytes)).toEqual([1, 2, 3])
    expect(r.mime).toBe("audio/ogg; codecs=opus")
    expect(fetchMock.mock.calls[0][0]).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/M1$/)
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer t" })
  })
  it("un archivo más grande que el límite no se descarga", async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { url: "https://x", file_size: 5_000_000 }))
    await expect(descargarMedia("M1", 1000)).rejects.toMatchObject({ status: 413 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
