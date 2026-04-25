import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const razas = await prisma.raza.findMany({
      orderBy: { nombre: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: razas,
    })
  } catch (error) {
    console.error("Error al obtener razas:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
