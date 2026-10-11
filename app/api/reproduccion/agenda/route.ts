import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { agendaReproductiva, sincronizarTareasReproductivas } from "@/lib/reproduccion/agenda"
import { respuestaError } from "@/lib/reproduccion/respuesta"
import { prisma } from "@/lib/prisma"

// GET /api/reproduccion/agenda?establecimientoId= — pendientes reproductivos (tacto, partos, señalada,
// destete) derivados de los eventos. Al consultarla se ponen al día sus Tareas (las que vencen
// en 30 días se crean; las ya cumplidas se completan).
export const GET = withAuth(async (request, ctx) => {
  try {
    const establecimientoId = z.string().uuid("Campo inválido").parse(request.nextUrl.searchParams.get("establecimientoId"))
    if (!ctx.establecimientoIds.includes(establecimientoId)) return NextResponse.json({ success: false, error: "Campo no encontrado" }, { status: 404 })
    await sincronizarTareasReproductivas(establecimientoId)
    const [pendientes, tareas] = await Promise.all([
      agendaReproductiva(establecimientoId),
      prisma.tarea.findMany({ where: { establecimientoId, tipo: "reproduccion", claveReproduccion: { not: null } }, select: { id: true, claveReproduccion: true, estado: true, asignadoA: { select: { nombre: true, apellido: true } } } }),
    ])
    const porClave = new Map(tareas.map((t) => [t.claveReproduccion, t]))
    return NextResponse.json({ success: true, data: pendientes.map((p) => ({ ...p, tarea: porClave.get(p.clave) ?? null })) })
  } catch (error) {
    return respuestaError(error, "agenda")
  }
})
