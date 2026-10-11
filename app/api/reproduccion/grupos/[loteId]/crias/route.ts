import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { criasDelGrupo } from "@/lib/reproduccion/grupos"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/grupos/[loteId]/crias — animales del grupo sin destete (destete por grupo)
export const GET = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await criasDelGrupo(ctx, z.string().uuid("Grupo inválido").parse(ctx.params.loteId)) })
  } catch (error) {
    return respuestaError(error, "crías del grupo")
  }
})
