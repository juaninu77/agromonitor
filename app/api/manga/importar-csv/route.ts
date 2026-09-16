import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { normalizeEID } from "@/lib/hardware/eid"
import { MangaSessionError, withMangaSession } from "@/lib/api/manga-session"

const importSchema = z.object({
  sessionId: z.string().uuid(),
  items: z.array(z.object({
    eidLeido: z.string().min(1),
    pesoKg: z.number().positive().optional().nullable(),
    timestampLectura: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Fecha inválida").optional().nullable(),
  })).min(1).max(1000),
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
    }

    const { sessionId, items } = parsed.data

    return await withMangaSession(sessionId, ctx.establecimientoIds, async (tx) => {
      const mangaSession = await tx.sesionManga.findFirst({
        where: { id: sessionId, ...scopeEstablecimiento(ctx.establecimientoIds) },
        select: { id: true, estado: true, establecimientoId: true },
      })

      if (!mangaSession) {
        return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
      }

      if (mangaSession.estado === "finalizada") {
        return NextResponse.json({ error: "No se puede importar a una sesión finalizada" }, { status: 400 })
      }

      const normalizedItems = items.map((item) => ({
        ...item,
        eidLeido: normalizeEID(item.eidLeido) ?? item.eidLeido,
      }))
      const animals = await tx.animal.findMany({
        where: {
          establecimientoId: mangaSession.establecimientoId,
          caravanaRfid: { in: normalizedItems.map((item) => item.eidLeido) },
        },
        select: { id: true, caravanaRfid: true },
      })
      const animalByEid = new Map(animals.map((animal) => [animal.caravanaRfid, animal.id]))

      const lastItem = await tx.sesionMangaItem.findFirst({
        where: { sesionId: sessionId },
        orderBy: { orden: "desc" },
        select: { orden: true },
      })
      let nextOrden = (lastItem?.orden || 0) + 1

      const created = await tx.sesionMangaItem.createMany({
        data: normalizedItems.map((item) => {
          const orden = nextOrden++
          return {
            sesionId: sessionId,
            orden,
            eidLeido: item.eidLeido,
            animalId: animalByEid.get(item.eidLeido) ?? null,
            pesoKg: item.pesoKg ?? undefined,
            timestampLectura: item.timestampLectura ? new Date(item.timestampLectura) : new Date(),
          }
        }),
      })

      await tx.sesionManga.update({
        where: { id: sessionId },
        data: { totalAnimales: { increment: created.count } },
      })

      return NextResponse.json({ imported: created.count })
    })
  } catch (error) {
    if (error instanceof MangaSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error al importar CSV:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
})
