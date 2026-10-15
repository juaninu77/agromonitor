// Lectura del payload del webhook de WhatsApp Cloud API. Solo interesan los
// mensajes entrantes; los avisos de estado (enviado, entregado, leído) se ignoran.

export type TipoMensaje = "texto" | "boton" | "lista" | "imagen" | "documento" | "audio" | "otro"

export interface MensajeEntrante {
  wamid: string
  waId: string
  nombre: string | null
  tipo: TipoMensaje
  /** Texto escrito, título del botón o fila elegida, o epígrafe del archivo */
  texto: string | null
  /** id del botón o de la fila elegida (interactivos) */
  respuestaId: string | null
  mediaId: string | null
  fecha: Date
}

interface Valor {
  metadata?: { phone_number_id?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: Record<string, unknown>[]
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

function leerMensaje(m: Record<string, unknown>, nombres: Map<string, string>): MensajeEntrante | null {
  const wamid = str(m.id), waId = str(m.from)
  if (!wamid || !waId) return null
  const segundos = Number(m.timestamp)
  const base = { wamid, waId, nombre: nombres.get(waId) ?? null, respuestaId: null, mediaId: null, fecha: Number.isFinite(segundos) ? new Date(segundos * 1000) : new Date() }
  switch (m.type) {
    case "text":
      return { ...base, tipo: "texto", texto: str(obj(m.text).body) }
    case "interactive": {
      const i = obj(m.interactive)
      const r = obj(i.type === "list_reply" ? i.list_reply : i.button_reply)
      return { ...base, tipo: i.type === "list_reply" ? "lista" : "boton", texto: str(r.title), respuestaId: str(r.id) }
    }
    case "button": // respuesta rápida de una plantilla
      return { ...base, tipo: "boton", texto: str(obj(m.button).text), respuestaId: str(obj(m.button).payload) }
    case "image":
    case "document":
    case "audio": {
      const media = obj(m[m.type as string])
      const tipo = m.type === "image" ? "imagen" : m.type === "document" ? "documento" : "audio"
      return { ...base, tipo, texto: str(media.caption), mediaId: str(media.id) }
    }
    default:
      return { ...base, tipo: "otro", texto: null }
  }
}

/** Mensajes entrantes dirigidos a nuestro número (si se indica `phoneNumberId`). */
export function mensajesDelWebhook(payload: unknown, phoneNumberId?: string): MensajeEntrante[] {
  const res: MensajeEntrante[] = []
  for (const entry of (obj(payload).entry as unknown[]) ?? []) {
    for (const change of (obj(entry).changes as unknown[]) ?? []) {
      const c = obj(change)
      if (c.field !== "messages") continue
      const v = obj(c.value) as Valor
      if (phoneNumberId && v.metadata?.phone_number_id !== phoneNumberId) continue
      const nombres = new Map((v.contacts ?? []).filter((x) => x.wa_id).map((x) => [x.wa_id!, x.profile?.name ?? ""]))
      for (const m of v.messages ?? []) {
        const leido = leerMensaje(obj(m), nombres)
        if (leido) res.push(leido)
      }
    }
  }
  return res
}
