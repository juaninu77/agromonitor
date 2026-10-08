import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { responder } from "@/lib/api/equipo-http"
import { aceptarInvitacion, verInvitacion } from "@/lib/equipo/service"

type Ctx = { params: Promise<{ token: string }> }

/** Público: datos de la invitación para quien tiene el enlace. */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { token } = await params
  return responder(() => verInvitacion(token))
}

/** Aceptar con la sesión iniciada (la cuenta tiene que ser la del email invitado). */
export async function POST(_request: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: "Iniciá sesión para aceptar la invitación" }, { status: 401 })
  const { token } = await params
  return responder(() => aceptarInvitacion(token, { id: session.user.id, email: session.user.email! }))
}
