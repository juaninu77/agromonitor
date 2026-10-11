import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { apartarVacias, vaciasDeTorada } from "@/lib/reproduccion/informes"
import { respuestaError } from "@/lib/reproduccion/respuesta"

const id = z.string().uuid("Torada inválida")

// GET /api/reproduccion/toradas/[id]/vacias — hembras de la torada que figuran vacías
export const GET = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await vaciasDeTorada(ctx, id.parse(ctx.params.id)) })
  } catch (error) {
    return respuestaError(error, "vacías de la torada")
  }
})

// POST /api/reproduccion/toradas/[id]/vacias — { loteDestinoId }: las aparta a otro grupo (no las da de baja)
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await apartarVacias(ctx, id.parse(ctx.params.id), await request.json()) })
  } catch (error) {
    return respuestaError(error, "apartar vacías")
  }
})
