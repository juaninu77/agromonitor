import { after, NextRequest, NextResponse } from "next/server"
import { whatsappConfig, whatsappConfigurado } from "@/lib/whatsapp/config"
import { verificarFirma } from "@/lib/whatsapp/firma"
import { mensajesDelWebhook } from "@/lib/whatsapp/webhook"
import { guardarEntrante, procesarMensaje } from "@/lib/whatsapp/procesar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// El mensaje se procesa después de responderle a Meta (after): consultas + respuesta del asistente
export const maxDuration = 300

// GET /api/whatsapp/webhook — verificación de la URL desde el panel de Meta
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const { verifyToken } = whatsappConfig()
  if (verifyToken && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } })
  }
  return NextResponse.json({ error: "No autorizado" }, { status: 403 })
}

// POST /api/whatsapp/webhook — mensajes entrantes (firmados por Meta). Se guardan, se responde
// 200 enseguida (si no, Meta reintenta) y se procesan en segundo plano.
export async function POST(request: NextRequest) {
  if (!whatsappConfigurado()) return NextResponse.json({ error: "WhatsApp no configurado" }, { status: 503 })
  const cuerpo = await request.text()
  const c = whatsappConfig()
  if (!verificarFirma(cuerpo, request.headers.get("x-hub-signature-256"), c.appSecret)) return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
  let payload: unknown
  try {
    payload = JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const ids: string[] = []
  for (const m of mensajesDelWebhook(payload, c.phoneNumberId)) {
    const id = await guardarEntrante(m)
    if (id) ids.push(id)
  }
  if (ids.length) {
    after(async () => {
      for (const id of ids) await procesarMensaje(id)
    })
  }
  return NextResponse.json({ ok: true })
}
