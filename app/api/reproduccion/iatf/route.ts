import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { crearProtocoloIatf, listarProtocolosIatf } from "@/lib/reproduccion/iatf"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/iatf?establecimientoId= — protocolos del campo, sus pasos y la concepción
export const GET = withAuth(async (request, ctx) => {
  try {
    const establecimientoId = z.string({ required_error: "Falta el campo" }).uuid("Campo inválido").parse(request.nextUrl.searchParams.get("establecimientoId") ?? undefined)
    return NextResponse.json({ success: true, data: await listarProtocolosIatf(ctx, establecimientoId) })
  } catch (error) {
    return respuestaError(error, "listar protocolos IATF")
  }
})

// POST /api/reproduccion/iatf — aplica una plantilla a hembras de una torada (una tarea por paso)
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await crearProtocoloIatf(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "crear protocolo IATF")
  }
})
