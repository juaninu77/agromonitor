import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { responder } from "@/lib/api/equipo-http"
import { cambiarPassword } from "@/lib/cuenta/service"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  return responder(async () => cambiarPassword(session.user.id, await request.json()))
}
