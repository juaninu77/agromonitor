import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { type AuthContext } from "@/lib/api/with-auth"

export class MapError extends Error { constructor(message: string, public status = 400) { super(message) } }
export function mapField(ctx: AuthContext, id: string, write = false) {
  const ids = write ? ctx.establecimientoIdsConRol(["admin", "encargado"]) : ctx.establecimientoIds
  if (!ids.includes(id)) throw new MapError("No tenés permisos para este campo", 403)
  return id
}
export async function mapBody(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && new URL(origin).host !== request.headers.get("host")) throw new MapError("Origen no permitido", 403)
  const reader = request.body?.getReader()
  if (!reader) throw new MapError("Solicitud vacía")
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { value, done } = await reader.read(); if (done) break
    size += value.length
    if (size > 60000) { await reader.cancel(); throw new MapError("El dibujo es demasiado grande", 413) }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
export async function mapResult(fn: () => Promise<Response>) {
  try { return await fn() } catch (error) {
    if (error instanceof MapError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 })
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return NextResponse.json({ error: "Ya existe un sector con ese nombre en este campo" }, { status: 409 })
      if (error.code === "P2025") return NextResponse.json({ error: "Otro usuario modificó el sector. Actualizá antes de guardar." }, { status: 409 })
    }
    console.error("Error en mapa", error)
    return NextResponse.json({ error: "No se pudo completar la operación del mapa" }, { status: 500 })
  }
}
