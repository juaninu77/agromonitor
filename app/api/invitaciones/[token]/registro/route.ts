import { NextRequest } from "next/server"
import { responder } from "@/lib/api/equipo-http"
import { registrarConInvitacion } from "@/lib/equipo/service"

/** Público: crear la cuenta desde la invitación (entra directo al espacio compartido, sin organización propia). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return responder(async () => registrarConInvitacion(token, await request.json()), 201)
}
