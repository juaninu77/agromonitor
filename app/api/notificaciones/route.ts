import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

// ============================================
// GET /api/notificaciones
// ============================================
// Retorna las últimas 50 notificaciones del usuario autenticado.
// Soporta filtro por ?leida=true|false

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const leidaParam = searchParams.get("leida")

    const where: Record<string, unknown> = {
      usuarioId: ctx.userId,
    }

    if (leidaParam === "true") {
      where.leida = true
    } else if (leidaParam === "false") {
      where.leida = false
    }

    const notificaciones = await prisma.notificacion.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: notificaciones,
    })
  } catch (error) {
    console.error("Error al obtener notificaciones:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// POST /api/notificaciones
// ============================================
// Crea una notificación para el usuario autenticado.
// El usuarioId nunca se acepta del cliente: siempre es el del contexto.

const createSchema = z.object({
  tipo: z.string().min(1, "El tipo es requerido"),
  titulo: z.string().min(1, "El título es requerido"),
  mensaje: z.string().min(1, "El mensaje es requerido"),
  url: z.string().optional(),
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const notificacion = await prisma.notificacion.create({
      data: {
        tipo: parsed.data.tipo,
        titulo: parsed.data.titulo,
        mensaje: parsed.data.mensaje,
        url: parsed.data.url,
        usuarioId: ctx.userId,
      },
    })

    return NextResponse.json(
      { success: true, data: notificacion },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear notificación:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// PATCH /api/notificaciones
// ============================================
// Marca notificaciones como leídas.
// Body: { ids: string[] } para marcar específicas,
//        { all: true }    para marcar todas.

const patchSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1, "Se requiere al menos un ID") }),
  z.object({ all: z.literal(true) }),
])

export const PATCH = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos. Envía { ids: string[] } o { all: true }" },
        { status: 400 }
      )
    }

    const data = parsed.data

    if ("all" in data) {
      await prisma.notificacion.updateMany({
        where: {
          usuarioId: ctx.userId,
          leida: false,
        },
        data: { leida: true },
      })
    } else {
      await prisma.notificacion.updateMany({
        where: {
          id: { in: data.ids },
          usuarioId: ctx.userId,
        },
        data: { leida: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al marcar notificaciones:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
