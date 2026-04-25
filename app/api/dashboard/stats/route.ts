import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const membresias = await prisma.membresia.findMany({
      where: { usuarioId: session.user.id, esActivo: true },
      include: {
        organizacion: {
          include: { establecimientos: true },
        },
      },
    })

    const establecimientoIds = membresias
      .flatMap((m) => m.organizacion.establecimientos)
      .map((e) => e.id)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const estFilter = establecimientoIds.length > 0 ? { in: establecimientoIds } : undefined

    // Animal no tiene establecimientoId directo.
    // Se filtra via loteHist -> lote -> establecimiento.
    const animalEstFilter = establecimientoIds.length > 0
      ? { loteHist: { some: { hasta: null, lote: { establecimientoId: { in: establecimientoIds } } } } }
      : {}

    const [
      totalAnimales,
      totalLotes,
      eventsSanidadMes,
      ventasMes,
      pesadasRecientes,
      tactosPendientes,
    ] = await Promise.all([
      prisma.animal.count({
        where: { estadoVital: "activo", ...animalEstFilter },
      }),
      prisma.lote.count({ where: { establecimientoId: estFilter } }),
      prisma.evtSanidad.count({
        where: {
          fecha: { gte: startOfMonth },
          OR: [
            { animal: animalEstFilter },
            { lote: { establecimientoId: estFilter } },
          ],
        },
      }).catch(() => 0),
      prisma.evtBaja.count({
        where: {
          fecha: { gte: startOfMonth },
          motivo: "venta",
          animal: animalEstFilter,
        },
      }).catch(() => 0),
      prisma.evtPesada.count({
        where: {
          fecha: { gte: thirtyDaysAgo },
          OR: [
            { animal: animalEstFilter },
            { lote: { establecimientoId: estFilter } },
          ],
        },
      }).catch(() => 0),
      prisma.evtTacto.count({
        where: {
          resultado: "preñada",
          fechaProbableParto: { gte: now, lte: in7Days },
          hembra: animalEstFilter,
        },
      }).catch(() => 0),
    ])

    const tieneDatos = totalAnimales > 0 || totalLotes > 0

    return NextResponse.json({
      success: true,
      data: {
        totalAnimales,
        totalEstablecimientos: establecimientoIds.length,
        totalLotes,
        tieneDatos,
        eventsSanidadMes,
        ventasMes,
        pesadasRecientes,
        paricionesProximas: tactosPendientes,
      },
    })
  } catch (error) {
    console.error("Error al obtener estadísticas del dashboard:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
