import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { asistenteConfigurado, MODELO_ASISTENTE, whatsappConfig, whatsappConfigurado } from "@/lib/whatsapp/config"
import { costosAnthropic, costosMeta } from "@/lib/whatsapp/costos"
import { metricasWhatsapp, PERIODOS_METRICAS, type DiasMetricas } from "@/lib/whatsapp/metricas"

// GET /api/whatsapp/metricas?dias=30 — uso y gasto del asistente de WhatsApp.
// El número y las claves son de toda la plataforma: solo lo ve un administrador de plataforma.
export const GET = withAuth(async (request, ctx) => {
  if (!ctx.esAdminPlataforma) return NextResponse.json({ error: "Solo un administrador de la plataforma puede ver el uso del asistente" }, { status: 403 })
  const pedido = Number(request.nextUrl.searchParams.get("dias") ?? 30)
  const dias: DiasMetricas = (PERIODOS_METRICAS as readonly number[]).includes(pedido) ? (pedido as DiasMetricas) : 30
  const metricas = await metricasWhatsapp(dias)
  const [anthropic, meta] = await Promise.all([costosAnthropic(metricas.desde, metricas.hasta), costosMeta(metricas.desde, metricas.hasta)])
  return NextResponse.json({
    data: {
      metricas,
      anthropic,
      meta,
      configuracion: {
        whatsapp: whatsappConfigurado(),
        asistente: asistenteConfigurado(),
        modelo: MODELO_ASISTENTE,
        numero: whatsappConfig().numero || null,
      },
    },
  })
})
