import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { MangaSessionError, withMangaSession } from "@/lib/api/manga-session"
import { registrarSanidadManga } from "@/lib/sanidad/service"
import { RESULTADOS_TACTO, calcularParto } from "@/lib/reproduccion/validation"

export const POST = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params

    return await withMangaSession(id, ctx.establecimientoIds, async (tx) => {
      const sesion = await tx.sesionManga.findFirst({
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
      let totalTactos = 0
      let totalNuevos = 0

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

        // Solo resultados válidos (un valor viejo inválido no debe deshacer toda la sesión)
        if (item.resultadoTacto && (RESULTADOS_TACTO as readonly string[]).includes(item.resultadoTacto)) {
          const prenada = item.resultadoTacto === "preñada"
          // Preñada con meses: fecha probable de parto según la especie (spec 03 §3.7)
          const especie = prenada && item.mesesGestacion
            ? (await tx.animal.findUnique({ where: { id: item.animalId }, select: { especie: { select: { nombre: true } } } }))?.especie.nombre
            : null
          const parto = prenada ? calcularParto(especie, sesion.fecha.toISOString().slice(0, 10), { mesesGest: item.mesesGestacion }) : null
          await tx.evtTacto.create({
            data: {
              fecha: sesion.fecha,
              resultado: item.resultadoTacto,
              mesesGest: prenada ? item.mesesGestacion ?? null : null,
              fechaProbableParto: parto?.fecha ? new Date(`${parto.fecha}T00:00:00Z`) : null,
              hembraId: item.animalId,
              establecimientoId: sesion.establecimientoId,
            },
          })
          totalTactos++
        }
      }

      // Tratamiento de la sesión: por el camino de Sanidad (un evento por animal marcado y activo,
      // agrupados por la sesión; el stock se descuenta sin trabar el cierre y se informa el faltante)
      const marcados = sesion.items.filter((i) => i.accionSanidad && i.animalId).map((i) => i.animalId as string)
      const sanidad = sesion.productoSanidadId && marcados.length
        ? await registrarSanidadManga(tx, ctx, { ...sesion, productoSanidadId: sesion.productoSanidadId }, marcados)
        : null
      const totalSanidad = sanidad?.cantidad ?? 0
      const stock = sanidad?.stock ?? null
      const avisoStock = sanidad?.avisoStock ?? null
      const sanidadOmitidos = sanidad?.omitidos ?? 0

      const resultado = {
        totalProcesados: sesion.items.length,
        totalPesados,
        totalSanidad,
        totalTactos,
        totalNuevos,
        sanidadOmitidos,
        stock,
        avisoStock,
      }

      return NextResponse.json({ success: true, data: resultado })
    })
  } catch (error) {
    if (error instanceof MangaSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error al finalizar sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
