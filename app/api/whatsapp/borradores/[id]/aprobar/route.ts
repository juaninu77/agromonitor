import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { aprobarBorrador, BorradorError } from "@/lib/whatsapp/borradores"

// POST /api/whatsapp/borradores/[id]/aprobar — un admin o encargado del campo aprueba una carga
// por WhatsApp: se registra con sus permisos y el mismo servicio que la web. Si hay que aceptar
// un aviso (lote vencido, venta bajo retiro…) responde tipo «confirmar»: se vuelve a aprobar.
export const POST = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ data: await aprobarBorrador(ctx, ctx.params.id) })
  } catch (e) {
    if (e instanceof BorradorError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error("Error al aprobar una carga de WhatsApp", e)
    return NextResponse.json({ error: "No se pudo aprobar. Probá de nuevo." }, { status: 500 })
  }
})
