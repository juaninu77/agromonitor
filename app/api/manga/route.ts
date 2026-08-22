import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { loteDelTenant } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

const crearSesionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  tipo: z.enum(
    ["pesada", "pesada_rodeo", "sanidad", "vacunacion", "tacto", "general", "señalada", "destete", "recepcion"],
    { errorMap: () => ({ message: "Tipo de sesión inválido" }) }
  ),
  accionesHabilitadas: z.array(z.string()).min(1, "Debe habilitar al menos una acción"),
  establecimientoId: z.string().uuid("ID de establecimiento inválido"),
  loteOrigenId: z.string().uuid("ID de lote inválido").optional().nullable(),
  productoSanidadId: z.string().uuid("ID de producto inválido").optional().nullable(),
  dosisSanidad: z.number().positive("La dosis debe ser mayor a 0").optional().nullable(),
  observaciones: z.string().optional().nullable(),
})

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")
    const estado = searchParams.get("estado")

    if (!establecimientoId) {
      return NextResponse.json(
        { error: "establecimientoId es requerido" },
        { status: 400 }
      )
    }

    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    // Ya validado contra ctx.establecimientoIds: la query queda scopeada al tenant
    const where: Record<string, unknown> = { establecimientoId }

    if (estado) {
      where.estado = estado
    }

    const sesiones = await prisma.sesionManga.findMany({
      where: where as any,
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: sesiones })
  } catch (error) {
    console.error("Error al obtener sesiones de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = crearSesionSchema.safeParse(body)

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

    const {
      nombre,
      fecha,
      tipo,
      accionesHabilitadas,
      establecimientoId,
      loteOrigenId,
      productoSanidadId,
      dosisSanidad,
      observaciones,
    } = parsed.data

    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    if (loteOrigenId) {
      const lote = await loteDelTenant(loteOrigenId, ctx.establecimientoIds)
      if (!lote) {
        return NextResponse.json(
          { error: "Lote no encontrado" },
          { status: 404 }
        )
      }
    }

    const sesion = await prisma.sesionManga.create({
      data: {
        nombre,
        fecha: new Date(fecha),
        tipo,
        accionesHabilitadas,
        establecimientoId,
        operadorId: ctx.userId,
        loteOrigenId: loteOrigenId ?? null,
        productoSanidadId: productoSanidadId ?? null,
        dosisSanidad: dosisSanidad ?? null,
        observaciones: observaciones ?? null,
      },
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: sesion }, { status: 201 })
  } catch (error) {
    console.error("Error al crear sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
