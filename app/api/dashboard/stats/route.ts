import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento, scopeEventoAnimalOLote } from "@/lib/api/tenant"

export const GET = withAuth(async (_request, ctx) => {
  try {
    const { establecimientoIds } = ctx

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalAnimales,
      totalLotes,
      eventsSanidadMes,
      ventasMes,
      pesadasRecientes,
      tactosPendientes,
    ] = await Promise.all([
      prisma.animal.count({
        where: { estadoVital: "activo", ...scopeEstablecimiento(establecimientoIds) },
      }),
      prisma.lote.count({ where: scopeEstablecimiento(establecimientoIds) }),
      prisma.evtSanidad.count({
        where: {
          fecha: { gte: startOfMonth },
          ...scopeEventoAnimalOLote(establecimientoIds),
        },
      }).catch(() => 0),
      prisma.evtBaja.count({
        where: {
          fecha: { gte: startOfMonth },
          motivo: "venta",
          animal: scopeEstablecimiento(establecimientoIds),
        },
      }).catch(() => 0),
      prisma.evtPesada.count({
        where: {
          fecha: { gte: thirtyDaysAgo },
          ...scopeEventoAnimalOLote(establecimientoIds),
        },
      }).catch(() => 0),
      prisma.evtTacto.count({
        where: {
          resultado: "preñada",
          fechaProbableParto: { gte: now, lte: in7Days },
          hembra: scopeEstablecimiento(establecimientoIds),
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
})
