import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { editarTorada } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// PATCH /api/reproduccion/toradas/[id] — cerrar (fechaFin), toros asignados (machoIds) y datos
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const id = z.string().uuid("Torada inválida").parse(ctx.params.id)
    return NextResponse.json({ success: true, data: await editarTorada(ctx, id, await request.json()) })
  } catch (error) {
    return respuestaError(error, "editar torada")
  }
})
