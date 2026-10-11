import { NextResponse } from "next/server"
import { errorReproduccion } from "./service"

/** Respuesta de error de las rutas de reproducción (400/403/404/409 con mensaje; 500 si es inesperado). */
export function respuestaError(error: unknown, que: string) {
  const r = errorReproduccion(error)
  if (r) return NextResponse.json(r.body, { status: r.status })
  console.error(`Error de reproducción (${que}):`, error)
  return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
}
