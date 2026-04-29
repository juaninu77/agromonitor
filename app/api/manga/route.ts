import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")
    const estado = searchParams.get("estado")

    if (!establecimientoId) {
      return NextResponse.json(
        { error: "establecimientoId es requerido" },
        { status: 400 }
      )
    }

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
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

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

    const sesion = await prisma.sesionManga.create({
      data: {
        nombre,
        fecha: new Date(fecha),
        tipo,
        accionesHabilitadas,
        establecimientoId,
        operadorId: session.user.id,
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
}
