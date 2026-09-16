import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { MangaSessionError, withMangaSession } from "@/lib/api/manga-session"

const actualizarSesionSchema = z.object({
  nombre: z.string().min(1).optional(),
  estado: z.enum(["activa", "pausada"]).optional(),
  observaciones: z.string().nullable().optional(),
})

export const GET = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params

    const sesion = await prisma.sesionManga.findFirst({
      where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
        items: {
          orderBy: { orden: "asc" },
        },
        loteOrigen: {
          select: { id: true, nombre: true },
        },
      },
    })

    if (!sesion) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: sesion })
  } catch (error) {
    console.error("Error al obtener sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const PATCH = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params
    const body = await request.json()
    const parsed = actualizarSesionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    return await withMangaSession(id, ctx.establecimientoIds, async (tx) => {
      const existing = await tx.sesionManga.findFirst({
        where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
      })

      if (!existing) {
        return NextResponse.json(
          { error: "Sesión no encontrada" },
          { status: 404 }
        )
      }

      const sesion = await tx.sesionManga.update({
        where: { id },
        data: parsed.data,
        include: {
          operador: {
            select: { id: true, nombre: true, apellido: true },
          },
        },
      })

      return NextResponse.json({ success: true, data: sesion })
    })
  } catch (error) {
    if (error instanceof MangaSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error al actualizar sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(
  async (request, ctx) => {
    try {
      const { id } = ctx.params

      const existing = await withMangaSession(id, ctx.establecimientoIdsConRol(["admin", "encargado"]), async (tx) => {
        const session = await tx.sesionManga.findFirstOrThrow({
          where: {
            id,
            ...scopeEstablecimiento(ctx.establecimientoIdsConRol(["admin", "encargado"])),
          },
      })

      await tx.sesionManga.delete({ where: { id } })
      return session
      })

      await logAudit({
        userId: ctx.userId,
        tabla: "sesiones_manga",
        rowPk: id,
        accion: "DELETE",
        detalle: { nombre: existing.nombre, estado: existing.estado },
        organizacionId: ctx.organizacionDeEstablecimiento[existing.establecimientoId],
      })

      return NextResponse.json({ success: true, message: "Sesión eliminada" })
    } catch (error) {
      if (error instanceof MangaSessionError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      console.error("Error al eliminar sesión de manga:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
