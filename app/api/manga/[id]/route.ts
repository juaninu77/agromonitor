import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

const actualizarSesionSchema = z.object({
  nombre: z.string().min(1).optional(),
  estado: z.enum(["activa", "pausada", "finalizada"]).optional(),
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

    const existing = await prisma.sesionManga.findFirst({
      where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }

    if (parsed.data.estado === "finalizada" && existing.estado !== "finalizada") {
      data.finalizadaAt = new Date()
    }

    const sesion = await prisma.sesionManga.update({
      where: { id },
      data: data as any,
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: sesion })
  } catch (error) {
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

      const existing = await prisma.sesionManga.findFirst({
        where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
      })

      if (!existing) {
        return NextResponse.json(
          { error: "Sesión no encontrada" },
          { status: 404 }
        )
      }

      if (!["activa", "pausada"].includes(existing.estado)) {
        return NextResponse.json(
          { error: "Solo se pueden eliminar sesiones activas o pausadas" },
          { status: 400 }
        )
      }

      await prisma.sesionManga.delete({ where: { id } })

      return NextResponse.json({ success: true, message: "Sesión eliminada" })
    } catch (error) {
      console.error("Error al eliminar sesión de manga:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
