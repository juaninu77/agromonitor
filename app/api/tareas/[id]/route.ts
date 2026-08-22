import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
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

async function getTareaDelTenant(tareaId: string, establecimientoIds: string[]) {
  return prisma.tarea.findFirst({
    where: {
      id: tareaId,
      ...scopeEstablecimiento(establecimientoIds),
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

export const GET = withAuth(async (_request, ctx) => {
  try {
    const { id } = ctx.params
    const tarea = await getTareaDelTenant(id, ctx.establecimientoIds)

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
})

// ============================================
// PATCH /api/tareas/[id]
// ============================================

export const PATCH = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params
    const existingTarea = await getTareaDelTenant(id, ctx.establecimientoIds)

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
      userId: ctx.userId,
      tabla: "tareas",
      rowPk: tarea.id,
      accion: "UPDATE",
      detalle: { cambios: data },
      organizacionId: ctx.organizacionDeEstablecimiento[tarea.establecimientoId] ?? null,
    })

    return NextResponse.json({ success: true, data: tarea })
  } catch (error) {
    console.error("Error al actualizar tarea:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// DELETE /api/tareas/[id]
// ============================================

export const DELETE = withAuth(
  async (_request, ctx) => {
    try {
      const { id } = ctx.params
      const existingTarea = await getTareaDelTenant(
        id,
        ctx.establecimientoIdsConRol(["admin", "encargado"])
      )

      if (!existingTarea) {
        return NextResponse.json(
          { error: "Tarea no encontrada" },
          { status: 404 }
        )
      }

      await prisma.tarea.delete({ where: { id } })

      await logAudit({
        userId: ctx.userId,
        tabla: "tareas",
        rowPk: id,
        accion: "DELETE",
        detalle: { titulo: existingTarea.titulo },
        organizacionId: ctx.organizacionDeEstablecimiento[existingTarea.establecimientoId] ?? null,
      })

      return NextResponse.json({ success: true, message: "Tarea eliminada" })
    } catch (error) {
      console.error("Error al eliminar tarea:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
