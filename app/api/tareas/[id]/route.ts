import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/api/audit-log"

const tareaUpdateSchema = z.object({
  titulo: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(["sanitario", "mantenimiento", "movimiento", "general"]).optional(),
  estado: z.enum(["pendiente", "en_progreso", "completada", "cancelada"]).optional(),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).optional(),
  fechaLimite: z.string().nullable().optional(),
  asignadoAId: z.string().uuid().nullable().optional(),
  observ: z.string().optional(),
})

async function getTareaConAcceso(tareaId: string, userId: string) {
  return prisma.tarea.findFirst({
    where: {
      id: tareaId,
      establecimiento: {
        organizacion: {
          membresias: {
            some: {
              usuarioId: userId,
              esActivo: true,
            },
          },
        },
      },
    },
    include: {
      asignadoA: {
        select: { id: true, nombre: true, apellido: true },
      },
      establecimiento: {
        select: { id: true, nombre: true },
      },
    },
  })
}

// ============================================
// GET /api/tareas/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const tarea = await getTareaConAcceso(id, session.user.id)

    if (!tarea) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: tarea })
  } catch (error) {
    console.error("Error al obtener tarea:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH /api/tareas/[id]
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const existingTarea = await getTareaConAcceso(id, session.user.id)

    if (!existingTarea) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = tareaUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Si el estado cambia a "completada", registrar la fecha
    const updateData: Record<string, unknown> = { ...data }
    if (data.fechaLimite !== undefined) {
      updateData.fechaLimite = data.fechaLimite ? new Date(data.fechaLimite) : null
    }
    if (data.estado === "completada" && existingTarea.estado !== "completada") {
      updateData.fechaCompletada = new Date()
    }
    if (data.estado && data.estado !== "completada") {
      updateData.fechaCompletada = null
    }

    const tarea = await prisma.tarea.update({
      where: { id },
      data: updateData as any,
      include: {
        asignadoA: {
          select: { id: true, nombre: true, apellido: true },
        },
        establecimiento: {
          select: { id: true, nombre: true },
        },
      },
    })

    await logAudit({
      userId: session.user.id,
      tabla: "tareas",
      rowPk: tarea.id,
      accion: "UPDATE",
      detalle: { cambios: data },
    })

    return NextResponse.json({ success: true, data: tarea })
  } catch (error) {
    console.error("Error al actualizar tarea:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/tareas/[id]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const existingTarea = await getTareaConAcceso(id, session.user.id)

    if (!existingTarea) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      )
    }

    await prisma.tarea.delete({ where: { id } })

    await logAudit({
      userId: session.user.id,
      tabla: "tareas",
      rowPk: id,
      accion: "DELETE",
      detalle: { titulo: existingTarea.titulo },
    })

    return NextResponse.json({ success: true, message: "Tarea eliminada" })
  } catch (error) {
    console.error("Error al eliminar tarea:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
