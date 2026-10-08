import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { responder } from "@/lib/api/equipo-http"
import { aceptarInvitacionPorId } from "@/lib/equipo/service"

/** Aceptar una invitación propia desde «Mi cuenta» (requiere email verificado). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ invitacionId: string }> }) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const { invitacionId } = await params
  if (!z.string().uuid().safeParse(invitacionId).success) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
  return responder(() => aceptarInvitacionPorId(invitacionId, { id: session.user.id, email: session.user.email! }))
}
