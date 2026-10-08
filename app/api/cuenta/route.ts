import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { responder } from "@/lib/api/equipo-http"
import { actualizarPerfil, miCuenta } from "@/lib/cuenta/service"

// Sin withAuth: una cuenta sin organizaciones (p. ej. que salió de todas) también tiene que poder verse.
async function usuarioId() {
  const session = await auth()
  return session?.user?.id ?? null
}
const noAutenticado = () => NextResponse.json({ error: "No autenticado" }, { status: 401 })

export async function GET() {
  const id = await usuarioId(); if (!id) return noAutenticado()
  return responder(() => miCuenta(id))
}

export async function PATCH(request: Request) {
  const id = await usuarioId(); if (!id) return noAutenticado()
  return responder(async () => actualizarPerfil(id, await request.json()))
}
