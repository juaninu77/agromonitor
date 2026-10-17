import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { BorradorError, rechazarBorrador } from "@/lib/whatsapp/borradores"

const schema = z.object({ motivo: z.string({ required_error: "Indicá el motivo" }).trim().min(3, "Indicá el motivo").max(500) })

// POST /api/whatsapp/borradores/[id]/rechazar — un admin o encargado del campo rechaza una carga
// por WhatsApp con un motivo; a quien la mandó le llega el aviso.
export const POST = withAuth(async (request, ctx) => {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 })
  try {
    return NextResponse.json({ data: await rechazarBorrador(ctx, ctx.params.id, parsed.data.motivo) })
  } catch (e) {
    if (e instanceof BorradorError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error("Error al rechazar una carga de WhatsApp", e)
    return NextResponse.json({ error: "No se pudo rechazar. Probá de nuevo." }, { status: 500 })
  }
})
