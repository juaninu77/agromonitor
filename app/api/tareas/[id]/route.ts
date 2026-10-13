import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { usuarioConAccesoACampo } from "@/lib/equipo/acceso"
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
  sectorId: z.string().uuid().nullable().optional(),
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

    // Cancelar es lo mismo que la papelera: solo administrador o encargado de ese campo
    if (data.estado === "cancelada" && existingTarea.estado !== "cancelada"
      && !ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(existingTarea.establecimientoId)) {
      return NextResponse.json({ error: "Solo un administrador o encargado del campo puede cancelar tareas" }, { status: 403 })
    }

    // Solo se asigna a alguien del equipo con acceso a ese campo
    if (data.asignadoAId && !(await usuarioConAccesoACampo(data.asignadoAId, existingTarea.establecimientoId))) {
      return NextResponse.json({ error: "La persona asignada no tiene acceso a este campo" }, { status: 400 })
    }

    if (data.sectorId) {
      const sector = await prisma.sector.findFirst({ where: { id: data.sectorId, establecimientoId: existingTarea.establecimientoId, activo: true }, select: { id: true } })
      if (!sector) {
        return NextResponse.json({ error: "El lugar no pertenece a este campo" }, { status: 400 })
      }
    }

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
// DELETE /api/tareas/[id] — cancela la tarea (nunca la borra)
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

      // Las tareas no se borran: se cancelan y quedan en «Canceladas». Las del plan sanitario o la agenda
      // reproductiva siguen vinculadas a su plan, y una cancelada de la agenda no se vuelve a crear.
      if (existingTarea.estado === "cancelada") {
        return NextResponse.json({ success: true, cancelada: true, message: "La tarea ya estaba cancelada" })
      }
      if (existingTarea.estado === "completada") {
        return NextResponse.json({ error: "Una tarea completada no se cancela" }, { status: 409 })
      }

      await prisma.tarea.update({ where: { id }, data: { estado: "cancelada", fechaCompletada: null } })

      await logAudit({
        userId: ctx.userId,
        tabla: "tareas",
        rowPk: id,
        accion: "UPDATE",
        detalle: { titulo: existingTarea.titulo, cancelada: true, estadoAnterior: existingTarea.estado },
        organizacionId: ctx.organizacionDeEstablecimiento[existingTarea.establecimientoId] ?? null,
      })

      return NextResponse.json({ success: true, cancelada: true, message: "Tarea cancelada" })
    } catch (error) {
      console.error("Error al cancelar tarea:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
