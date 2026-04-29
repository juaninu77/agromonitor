import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const crearItemSchema = z.object({
  eidLeido: z.string().min(1, "El EID es requerido"),
  pesoKg: z.number().positive().optional().nullable(),
  cc: z.number().min(1).max(9).optional().nullable(),
  denticion: z.string().optional().nullable(),
  resultadoTacto: z.string().optional().nullable(),
  mesesGestacion: z.number().positive().optional().nullable(),
  accionSanidad: z.boolean().optional(),
  apartadoA: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  animalId: z.string().uuid().optional().nullable(),
  esNuevoRegistro: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id } = await params

    const sesion = await prisma.sesionManga.findUnique({ where: { id } })

    if (!sesion) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      )
    }

    const items = await prisma.sesionMangaItem.findMany({
      where: { sesionId: id },
      orderBy: { orden: "asc" },
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error("Error al obtener items de sesión:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = crearItemSchema.safeParse(body)

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

    const sesion = await prisma.sesionManga.findUnique({ where: { id } })

    if (!sesion) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      )
    }

    if (sesion.estado === "finalizada") {
      return NextResponse.json(
        { error: "No se pueden agregar items a una sesión finalizada" },
        { status: 400 }
      )
    }

    const maxOrden = await prisma.sesionMangaItem.aggregate({
      where: { sesionId: id },
      _max: { orden: true },
    })

    const nuevoOrden = (maxOrden._max.orden ?? 0) + 1

    const [item] = await prisma.$transaction([
      prisma.sesionMangaItem.create({
        data: {
          sesionId: id,
          orden: nuevoOrden,
          eidLeido: parsed.data.eidLeido,
          pesoKg: parsed.data.pesoKg ?? null,
          cc: parsed.data.cc ?? null,
          denticion: parsed.data.denticion ?? null,
          resultadoTacto: parsed.data.resultadoTacto ?? null,
          mesesGestacion: parsed.data.mesesGestacion ?? null,
          accionSanidad: parsed.data.accionSanidad ?? false,
          apartadoA: parsed.data.apartadoA ?? null,
          observaciones: parsed.data.observaciones ?? null,
          animalId: parsed.data.animalId ?? null,
          esNuevoRegistro: parsed.data.esNuevoRegistro ?? false,
        },
      }),
      prisma.sesionManga.update({
        where: { id },
        data: { totalAnimales: { increment: 1 } },
      }),
    ])

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error("Error al agregar item a sesión:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
