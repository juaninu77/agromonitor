// Envío de mensajes por la Graph API de WhatsApp Cloud (sin dependencias).
// Los límites de largo son los de Meta: texto 4096, botón 20, fila 24, descripción 72.

import { whatsappConfig } from "./config"

export class WhatsappError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
  }
}

export interface Boton { id: string; titulo: string }
export interface Fila { id: string; titulo: string; descripcion?: string }

const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t)

async function llamar(body: Record<string, unknown>): Promise<string | null> {
  const c = whatsappConfig()
  const res = await fetch(`https://graph.facebook.com/${c.graphVersion}/${c.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } }
  // Nunca se registra el cuerpo enviado (puede tener datos del campo)
  if (!res.ok) throw new WhatsappError(json.error?.message ?? `Error ${res.status} de WhatsApp`, res.status)
  return json.messages?.[0]?.id ?? null
}

/** Parte un texto largo en mensajes de hasta 4096 caracteres, cortando en saltos de línea. */
export function partirTexto(texto: string, max = 4096): string[] {
  const partes: string[] = []
  let resto = texto.trim()
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max)
    if (corte < max / 2) corte = resto.lastIndexOf(" ", max)
    if (corte < max / 2) corte = max
    partes.push(resto.slice(0, corte).trimEnd())
    resto = resto.slice(corte).trimStart()
  }
  if (resto) partes.push(resto)
  return partes
}

export async function enviarTexto(to: string, texto: string): Promise<string | null> {
  let ultimo: string | null = null
  for (const parte of partirTexto(texto)) ultimo = await llamar({ recipient_type: "individual", to, type: "text", text: { preview_url: false, body: parte } })
  return ultimo
}

/** Hasta 3 botones de respuesta rápida. */
export function enviarBotones(to: string, texto: string, botones: Boton[]) {
  return llamar({
    recipient_type: "individual", to, type: "interactive",
    interactive: { type: "button", body: { text: corto(texto, 1024) }, action: { buttons: botones.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: corto(b.titulo, 20) } })) } },
  })
}

/** Lista desplegable de hasta 10 opciones. */
export function enviarLista(to: string, texto: string, boton: string, filas: Fila[]) {
  return llamar({
    recipient_type: "individual", to, type: "interactive",
    interactive: {
      type: "list", body: { text: corto(texto, 1024) },
      action: { button: corto(boton, 20), sections: [{ title: corto(boton, 24), rows: filas.slice(0, 10).map((f) => ({ id: f.id, title: corto(f.titulo, 24), ...(f.descripcion ? { description: corto(f.descripcion, 72) } : {}) })) }] },
    },
  })
}

/** Marca el mensaje como leído y muestra «escribiendo…» mientras se prepara la respuesta. */
export async function marcarLeido(wamid: string) {
  try {
    await llamar({ status: "read", message_id: wamid, typing_indicator: { type: "text" } })
  } catch {
    // No es crítico: si falla, igual se responde
  }
}
