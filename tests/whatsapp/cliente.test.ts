import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { enviarTexto, WhatsappError } from "@/lib/whatsapp/cliente"

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
