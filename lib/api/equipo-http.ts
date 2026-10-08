import { NextRequest, NextResponse } from "next/server"
import { respuestaEquipo } from "@/lib/equipo/service"

/** Origen público para armar enlaces de invitación. */
export const origenPublico = (request: NextRequest) =>
  (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? request.nextUrl.origin).replace(/\/+$/, "")

/** Ejecuta y traduce errores de equipo/cuenta a { error } con su status. */
export async function responder(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json({ data: await fn() }, { status, headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const r = respuestaEquipo(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error en equipo/cuenta", error instanceof Error ? error.name : "desconocido")
    return NextResponse.json({ error: "No se pudo completar la operación" }, { status: 500 })
  }
}
