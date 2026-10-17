import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEventoAnimal } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"
import { erroresZod, mapearErrorPrisma } from "@/lib/ganado/alta"
import { EventoGanadoError, registrarPesadas } from "@/lib/ganado/eventos"
import { pesadaSchema } from "@/lib/validations/eventos-schema"

// ============================================
// POST /api/ganado/pesos
// ============================================
// Registra una pesada individual. Cualquier rol de la organización puede
// pesar (es trabajo de campo), pero el animal debe estar activo y la fecha
// no puede ser futura.

export const POST = withAuth(async (req, ctx) => {
  try {
    const parsed = pesadaSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      const errores = erroresZod(parsed.error)
      return NextResponse.json({ success: false, error: errores[0], errores }, { status: 400 })
    }
    const [pesada] = await registrarPesadas(ctx, [parsed.data])
    return NextResponse.json(
      { success: true, data: pesada, message: "Pesada registrada exitosamente" },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof EventoGanadoError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    const conocido = mapearErrorPrisma(error)
    if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
    console.error("Error al crear pesada:", error)
    return NextResponse.json({ success: false, error: "Error al registrar la pesada" }, { status: 500 })
  }
})

// ============================================
// GET /api/ganado/pesos?animalId=
// ============================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url)
    const animalId = searchParams.get("bovinoId") || searchParams.get("animalId")

    if (!animalId) {
      return NextResponse.json(
        { success: false, error: "Se requiere el ID del animal (animalId)" },
        { status: 400 }
      )
    }

    const pesos = await prisma.evtPesada.findMany({
      where: {
        animalId,
        ...scopeEventoAnimal(ctx.establecimientoIds),
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    })

    return NextResponse.json({ success: true, data: pesos })
  } catch (error) {
    console.error("Error al obtener pesos:", error)
    return NextResponse.json({ success: false, error: "Error al obtener los pesos" }, { status: 500 })
  }
})
