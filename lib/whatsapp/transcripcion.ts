// Notas de voz del asistente de WhatsApp: Claude no recibe audio, así que se transcribe antes
// con OpenAI (gpt-4o-transcribe, en español) y el texto sigue el mismo camino que un mensaje
// escrito. Se le pasa un vocabulario con los nombres del campo para que los escriba bien.
// El audio no se guarda: solo la transcripción. Cambiar de proveedor es tocar este archivo.

import { prisma } from "@/lib/prisma"

export const transcripcionConfigurada = () => !!process.env.OPENAI_API_KEY

/** Modelo de transcripción (gpt-4o-mini-transcribe cuesta la mitad). */
export const MODELO_TRANSCRIPCION = process.env.WHATSAPP_MODELO_AUDIO || "gpt-4o-transcribe"

/** Unos 3 minutos de nota de voz de WhatsApp (OGG/Opus). */
export const MAX_AUDIO_BYTES = 1_500_000

// USD por millón de tokens (audio de entrada, texto de entrada, salida) y por minuto si se cobra por duración
const PRECIOS: Record<string, { audio: number; texto: number; salida: number; minuto: number }> = {
  "gpt-4o-transcribe": { audio: 6, texto: 2.5, salida: 10, minuto: 0.006 },
  "gpt-4o-mini-transcribe": { audio: 3, texto: 1.25, salida: 5, minuto: 0.003 },
}

const TERMINOS = [
  "caravana", "EID", "CUIG", "tacto", "preñada", "vacía", "servicio", "IATF", "inseminación", "parición", "destete", "celo", "señalada",
  "ternero", "ternera", "vaquillona", "novillo", "novillito", "vaca", "toro", "torito", "borrega", "oveja", "carnero", "cordero", "capón",
  "aftosa", "brucelosis", "carbunclo", "mancha", "gangrena", "queratoconjuntivitis", "ivermectina", "doramectina", "levamisol", "clostridial",
  "subcutánea", "intramuscular", "pour-on", "carencia", "retiro", "potrero", "corral", "manga", "aguada", "rollo", "fardo",
]

const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))]

/** Nombres del campo y de la organización (productos, grupos, potreros, categorías) + términos del rubro. */
export async function vocabularioDelCampo(establecimientoId: string, organizacionId: string, max = 900): Promise<string> {
  const [productos, grupos, lugares, categorias] = await Promise.all([
    prisma.producto.findMany({ where: { organizacionId, activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" }, take: 60 }),
    prisma.lote.findMany({ where: { establecimientoId, activo: true }, select: { nombre: true }, take: 40 }),
    prisma.sector.findMany({ where: { establecimientoId, activo: true, tipo: { in: ["potrero", "corral", "manga", "feedlot", "galpon"] } }, select: { nombre: true }, take: 60 }),
    prisma.categoria.findMany({ where: { OR: [{ organizacionId }, { organizacionId: null }] }, select: { nombre: true }, take: 40 }),
  ])
  let texto = "Mensaje de trabajo en un campo ganadero argentino."
  for (const palabra of unicos([...grupos, ...lugares, ...productos, ...categorias].map((x) => x.nombre).concat(TERMINOS))) {
    const siguiente = `${texto}${texto.endsWith(".") ? " " : ", "}${palabra}`
    if (siguiente.length > max) break
    texto = siguiente
  }
  return texto
}

const EXTENSION: Record<string, string> = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "m4a", "audio/wav": "wav", "audio/webm": "webm", "audio/amr": "amr" }

interface UsoTranscripcion {
  type?: "tokens" | "duration"
  input_tokens?: number
  output_tokens?: number
  input_token_details?: { audio_tokens?: number; text_tokens?: number }
  seconds?: number
}

/** Costo estimado de una transcripción a partir de lo que informa OpenAI. */
export function costoTranscripcionUsd(modelo: string, uso: UsoTranscripcion | undefined, bytes: number): number {
  const p = PRECIOS[modelo] ?? PRECIOS["gpt-4o-transcribe"]
  if (uso?.type === "tokens" || uso?.input_tokens != null) {
    const audio = uso.input_token_details?.audio_tokens ?? uso.input_tokens ?? 0
    const texto = uso.input_token_details?.text_tokens ?? 0
    return (audio * p.audio + texto * p.texto + (uso.output_tokens ?? 0) * p.salida) / 1_000_000
  }
  // Por duración, o estimada: una nota de voz de WhatsApp ronda los 2 KB por segundo
  const segundos = uso?.seconds ?? bytes / 2000
  return (segundos / 60) * p.minuto
}

export class TranscripcionError extends Error {}

export async function transcribirAudio(bytes: Uint8Array<ArrayBuffer>, mime: string, vocabulario: string, f: typeof fetch = fetch): Promise<{ texto: string; costoUsd: number }> {
  const tipo = mime.split(";")[0].trim().toLowerCase()
  const form = new FormData()
  form.append("file", new Blob([bytes], { type: tipo }), `nota.${EXTENSION[tipo] ?? "ogg"}`)
  form.append("model", MODELO_TRANSCRIPCION)
  form.append("language", "es")
  form.append("response_format", "json")
  form.append("prompt", vocabulario)
  const res = await f("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const json = (await res.json().catch(() => ({}))) as { text?: string; usage?: UsoTranscripcion; error?: { message?: string } }
  if (!res.ok) throw new TranscripcionError(json.error?.message ?? `OpenAI respondió ${res.status}`)
  return { texto: (json.text ?? "").trim(), costoUsd: costoTranscripcionUsd(MODELO_TRANSCRIPCION, json.usage, bytes.byteLength) }
}
