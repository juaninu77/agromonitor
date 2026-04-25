import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createPesoSchema = z.object({
  bovinoId: z.string().uuid("ID de animal inválido"),
  peso: z.number().min(1, "El peso debe ser mayor a 0").max(2000, "Peso máximo 2000 kg"),
  fecha: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Fecha inválida",
  }),
  notas: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createPesoSchema.parse(body)

    const animal = await prisma.animal.findUnique({
      where: { id: validatedData.bovinoId },
    })

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    const pesada = await prisma.evtPesada.create({
      data: {
        animalId: validatedData.bovinoId,
        pesoKg: validatedData.peso,
        fecha: new Date(validatedData.fecha),
        observ: validatedData.notas,
      },
    })

    return NextResponse.json({
      success: true,
      data: pesada,
      message: "Pesada registrada exitosamente",
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error al crear pesada:", error)
    return NextResponse.json(
      { error: error.message || "Error al registrar la pesada" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const animalId = searchParams.get("bovinoId") || searchParams.get("animalId")

    if (!animalId) {
      return NextResponse.json(
        { error: "Se requiere el ID del animal (bovinoId o animalId)" },
        { status: 400 }
      )
    }

    const pesos = await prisma.evtPesada.findMany({
      where: { animalId },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: pesos })
  } catch (error: any) {
    console.error("Error al obtener pesos:", error)
    return NextResponse.json(
      { error: error.message || "Error al obtener los pesos" },
      { status: 500 }
    )
  }
}
