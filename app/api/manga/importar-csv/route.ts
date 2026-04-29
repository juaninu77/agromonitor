import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const importSchema = z.object({
  sessionId: z.string().uuid(),
  items: z.array(z.object({
    eidLeido: z.string().min(1),
    pesoKg: z.number().positive().optional().nullable(),
    timestampLectura: z.string().optional().nullable(),
  })),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
    }

    const { sessionId, items } = parsed.data

    const mangaSession = await prisma.sesionManga.findUnique({
      where: { id: sessionId },
      select: { id: true, estado: true },
    })

    if (!mangaSession) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
    }

    if (mangaSession.estado === "finalizada") {
      return NextResponse.json({ error: "No se puede importar a una sesión finalizada" }, { status: 400 })
    }

    const lastItem = await prisma.sesionMangaItem.findFirst({
      where: { sesionId: sessionId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    })
    let nextOrden = (lastItem?.orden || 0) + 1

    const created = await prisma.$transaction(
      items.map((item) => {
        const orden = nextOrden++
        return prisma.sesionMangaItem.create({
          data: {
            sesionId: sessionId,
            orden,
            eidLeido: item.eidLeido,
            pesoKg: item.pesoKg ?? undefined,
            timestampLectura: item.timestampLectura ? new Date(item.timestampLectura) : new Date(),
          },
        })
      })
    )

    await prisma.sesionManga.update({
      where: { id: sessionId },
      data: { totalAnimales: { increment: created.length } },
    })

    return NextResponse.json({ imported: created.length })
  } catch (error) {
    console.error("Error al importar CSV:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
