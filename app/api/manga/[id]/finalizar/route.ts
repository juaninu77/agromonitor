import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

export const POST = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params

    const sesion = await prisma.sesionManga.findFirst({
      where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
      include: { items: true },
    })

    if (!sesion) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      )
    }

    if (sesion.estado === "finalizada") {
      return NextResponse.json(
        { error: "La sesión ya está finalizada" },
        { status: 400 }
      )
    }

    const ahora = new Date()
    let totalPesados = 0
    let totalSanidad = 0
    let totalTactos = 0
    let totalNuevos = 0

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.sesionManga.update({
        where: { id },
        data: { estado: "finalizada", finalizadaAt: ahora },
      })

      for (const item of sesion.items) {
        if (item.esNuevoRegistro) totalNuevos++

        if (!item.animalId) continue

        if (item.pesoKg != null) {
          await tx.evtPesada.create({
            data: {
              fecha: sesion.fecha,
              pesoKg: item.pesoKg,
              cc: item.cc ?? null,
              animalId: item.animalId,
            },
          })
          totalPesados++
        }

        if (item.accionSanidad && sesion.productoSanidadId) {
          await tx.evtSanidad.create({
            data: {
              fecha: sesion.fecha,
              dosis: sesion.dosisSanidad ?? null,
              animalId: item.animalId,
              productoId: sesion.productoSanidadId,
            },
          })
          totalSanidad++
        }

        if (item.resultadoTacto) {
          await tx.evtTacto.create({
            data: {
              fecha: sesion.fecha,
              resultado: item.resultadoTacto,
              mesesGest: item.mesesGestacion ?? null,
              hembraId: item.animalId,
            },
          })
          totalTactos++
        }
      }

      return {
        totalProcesados: sesion.items.length,
        totalPesados,
        totalSanidad,
        totalTactos,
        totalNuevos,
      }
    })

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error("Error al finalizar sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
