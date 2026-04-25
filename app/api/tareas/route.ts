import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/api/audit-log"

const tareaSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().optional(),
  tipo: z.enum(["sanitario", "mantenimiento", "movimiento", "general"]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  fechaLimite: z.string().optional(),
  asignadoAId: z.string().uuid().optional(),
  establecimientoId: z.string().uuid(),
  observ: z.string().optional(),
})

// ============================================
// GET /api/tareas
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get("estado")
    const prioridad = searchParams.get("prioridad")
    const tipo = searchParams.get("tipo")
    const asignadoAId = searchParams.get("asignadoAId")
    const establecimientoId = searchParams.get("establecimientoId")

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "25")
    const skip = (page - 1) * limit

    const orderByField = searchParams.get("orderBy") || "createdAt"
    const orderDirection = (searchParams.get("orderDirection") || "desc") as "asc" | "desc"

    // Establecimientos accesibles por el usuario (vía membresías)
    const establecimientos = await prisma.establecimiento.findMany({
      where: {
        organizacion: {
          membresias: {
            some: {
              usuarioId: session.user.id,
              esActivo: true,
            },
          },
        },
      },
      select: { id: true },
    })

    const establecimientoIds = establecimientos.map((e) => e.id)

    if (establecimientoIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      })
    }

    // Construir filtros
    const where: Record<string, unknown> = {
      establecimientoId: { in: establecimientoIds },
    }

    if (establecimientoId && establecimientoIds.includes(establecimientoId)) {
      where.establecimientoId = establecimientoId
    }

    if (estado) where.estado = estado
    if (prioridad) where.prioridad = prioridad
    if (tipo) where.tipo = tipo
    if (asignadoAId) where.asignadoAId = asignadoAId

    // Ordenamiento
    const validOrderFields: Record<string, unknown> = {
      createdAt: { createdAt: orderDirection },
      fechaLimite: { fechaLimite: orderDirection },
      prioridad: { prioridad: orderDirection },
      titulo: { titulo: orderDirection },
      estado: { estado: orderDirection },
    }
    const orderByClause = validOrderFields[orderByField] || validOrderFields.createdAt

    const total = await prisma.tarea.count({ where: where as any })

    const tareas = await prisma.tarea.findMany({
      where: where as any,
      include: {
        asignadoA: {
          select: { id: true, nombre: true, apellido: true },
        },
        establecimiento: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: orderByClause as any,
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: tareas,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error("Error al obtener tareas:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/tareas
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = tareaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verificar acceso al establecimiento
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        id: data.establecimientoId,
        organizacion: {
          membresias: {
            some: {
              usuarioId: session.user.id,
              esActivo: true,
            },
          },
        },
      },
    })

    if (!establecimiento) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    const tarea = await prisma.tarea.create({
      data: {
        titulo: data.titulo,
        descripcion: data.descripcion,
        tipo: data.tipo,
        prioridad: data.prioridad,
        fechaLimite: data.fechaLimite ? new Date(data.fechaLimite) : null,
        asignadoAId: data.asignadoAId,
        establecimientoId: data.establecimientoId,
        observ: data.observ,
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

    await logAudit({
      userId: session.user.id,
      tabla: "tareas",
      rowPk: tarea.id,
      accion: "INSERT",
      detalle: { titulo: tarea.titulo, tipo: tarea.tipo },
    })

    return NextResponse.json(
      { success: true, data: tarea },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear tarea:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
