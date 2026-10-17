import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { bandejaWhatsapp } from "@/lib/whatsapp/borradores"

// GET /api/whatsapp/borradores — bandeja de cargas por WhatsApp: lo que espera validación en
// los campos donde el usuario es administrador o encargado, y lo revisado o mandado por él.
export const GET = withAuth(async (_request, ctx) => {
  return NextResponse.json({ data: await bandejaWhatsapp(ctx) })
})
