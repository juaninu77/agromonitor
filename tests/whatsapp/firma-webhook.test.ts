import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verificarFirma } from "@/lib/whatsapp/firma"
import { mensajesDelWebhook } from "@/lib/whatsapp/webhook"
import { partirTexto } from "@/lib/whatsapp/cliente"

const firmar = (cuerpo: string, secreto: string) => `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`

describe("firma de Meta", () => {
  it("acepta solo el cuerpo firmado con el App Secret", () => {
    const cuerpo = '{"object":"whatsapp_business_account"}'
    expect(verificarFirma(cuerpo, firmar(cuerpo, "secreto"), "secreto")).toBe(true)
    expect(verificarFirma(cuerpo + " ", firmar(cuerpo, "secreto"), "secreto")).toBe(false)
    expect(verificarFirma(cuerpo, firmar(cuerpo, "otro"), "secreto")).toBe(false)
    expect(verificarFirma(cuerpo, "sha256=abc", "secreto")).toBe(false)
    expect(verificarFirma(cuerpo, null, "secreto")).toBe(false)
    expect(verificarFirma(cuerpo, firmar(cuerpo, ""), "")).toBe(false)
  })
})

const payload = (messages: unknown[], phone = "PHONE", extra: Record<string, unknown> = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: phone }, contacts: [{ wa_id: "5492966111111", profile: { name: "Pedro" } }], messages, ...extra } }] }],
})

describe("lectura del webhook", () => {
  it("normaliza texto, botones, listas y archivos", () => {
    const r = mensajesDelWebhook(payload([
      { from: "5492966111111", id: "w1", timestamp: "1760000000", type: "text", text: { body: "¿cuánta ivermectina queda?" } },
      { from: "5492966111111", id: "w2", timestamp: "1760000001", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "campo:abc", title: "La Esperanza" } } },
      { from: "5492966111111", id: "w3", timestamp: "1760000002", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "si", title: "Confirmar" } } },
      { from: "5492966111111", id: "w4", timestamp: "1760000003", type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: "gasoil" } },
      { from: "5492966111111", id: "w5", timestamp: "1760000004", type: "audio", audio: { id: "M2", voice: true } },
      { from: "5492966111111", id: "w6", timestamp: "1760000005", type: "sticker", sticker: { id: "S" } },
    ]), "PHONE")
    expect(r.map((m) => [m.wamid, m.tipo, m.texto, m.respuestaId, m.mediaId])).toEqual([
      ["w1", "texto", "¿cuánta ivermectina queda?", null, null],
      ["w2", "lista", "La Esperanza", "campo:abc", null],
      ["w3", "boton", "Confirmar", "si", null],
      ["w4", "imagen", "gasoil", null, "M1"],
      ["w5", "audio", null, null, "M2"],
      ["w6", "otro", null, null, null],
    ])
    expect(r[0]).toMatchObject({ waId: "5492966111111", nombre: "Pedro", fecha: new Date(1760000000 * 1000) })
  })

  it("ignora avisos de estado, otros números y payloads raros", () => {
    expect(mensajesDelWebhook(payload([], "PHONE", { statuses: [{ id: "x", status: "read" }] }), "PHONE")).toEqual([])
    expect(mensajesDelWebhook(payload([{ from: "1", id: "w", type: "text", text: { body: "hola" } }], "OTRO"), "PHONE")).toEqual([])
    expect(mensajesDelWebhook(null)).toEqual([])
    expect(mensajesDelWebhook({ entry: [{ changes: [{ field: "messages", value: { messages: [{ type: "text" }] } }] }] })).toEqual([])
  })
})

describe("textos largos", () => {
  it("se parten en mensajes de hasta 4096 caracteres cortando en saltos de línea", () => {
    const linea = "x".repeat(1000)
    const partes = partirTexto(Array(10).fill(linea).join("\n"))
    expect(partes.every((p) => p.length <= 4096)).toBe(true)
    expect(partes.join("\n")).toBe(Array(10).fill(linea).join("\n"))
    expect(partirTexto("hola")).toEqual(["hola"])
  })
})
