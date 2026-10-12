import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { MangaSessionError, withMangaSession } from "@/lib/api/manga-session"
import { normalizeEID } from "@/lib/hardware/eid"
import { prisma } from "@/lib/prisma"
import { RESULTADOS_TACTO } from "@/lib/reproduccion/validation"
import { especieDelCampo, insertarAltas, prepararAltas } from "@/lib/ganado/alta"
import { especieParaAlta, faltaParaAlta } from "@/lib/hardware/manga-config"

const crearItemSchema = z.object({
  eidLeido: z.string().min(1, "El EID es requerido"),
  pesoKg: z.number().positive().optional().nullable(),
  cc: z.number().min(1).max(9).optional().nullable(),
  denticion: z.string().optional().nullable(),
  resultadoTacto: z.enum(RESULTADOS_TACTO, { errorMap: () => ({ message: "Resultado de tacto inválido" }) }).optional().nullable(),
  mesesGestacion: z.number().positive().max(10).optional().nullable(),
  accionSanidad: z.boolean().optional(),
  apartadoA: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  animalId: z.string().uuid().optional().nullable(),
  esNuevoRegistro: z.boolean().optional(),
  caravanaVisual: z.string().optional().nullable(),
  sexo: z.enum(["M", "F"]).optional().nullable(),
  categoria: z.string().optional().nullable(),
  // Alta de un EID nuevo: catálogo de la organización (o general)
  especieId: z.string().uuid().optional().nullable(),
  razaId: z.string().uuid().optional().nullable(),
  categoriaId: z.string().uuid().optional().nullable(),
})
  .refine((data) => !data.esNuevoRegistro || !data.animalId, { message: "Un alta nueva no puede referenciar un animal existente" })
  // Mismo mensaje que muestra la manga antes de enviar (también para lo cargado sin señal)
  .superRefine((data, c) => {
    const falta = data.esNuevoRegistro ? faltaParaAlta(data) : null
    if (falta) c.addIssue({ code: z.ZodIssueCode.custom, message: falta, path: [!data.sexo ? "sexo" : !data.razaId ? "razaId" : "categoriaId"] })
  })

export const GET = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params

    const sesion = await prisma.sesionManga.findFirst({
      where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
    })

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
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params
    const body = await request.json()
    const parsed = crearItemSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    return await withMangaSession(id, ctx.establecimientoIds, async (tx) => {
      const sesion = await tx.sesionManga.findFirst({
        where: { id, ...scopeEstablecimiento(ctx.establecimientoIds) },
      })

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

      // Normalizar server-side: HID, Web Serial y CSV deben interpretar el EID igual
      const eidNormalizado = normalizeEID(parsed.data.eidLeido) ?? parsed.data.eidLeido

      let animalId = parsed.data.animalId ?? null

      if (animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: animalId, establecimientoId: sesion.establecimientoId },
        })
        if (!animal) {
          return NextResponse.json(
            { error: "Animal no encontrado" },
            { status: 404 }
          )
        }
        if (parsed.data.resultadoTacto && animal.sexo !== "F") {
          return NextResponse.json({ error: "Solo se puede tactar a una hembra" }, { status: 400 })
        }
      }
      if (parsed.data.resultadoTacto && parsed.data.esNuevoRegistro && parsed.data.sexo !== "F") {
        return NextResponse.json({ error: "Solo se puede tactar a una hembra" }, { status: 400 })
      }

      const maxOrden = await tx.sesionMangaItem.aggregate({
        where: { sesionId: id },
        _max: { orden: true },
      })

      const nuevoOrden = (maxOrden._max.orden ?? 0) + 1

      // EID nuevo: alta por el mismo camino que Ganado (catálogo, duplicados de RFID y caravana)
      let categoriaNombre = parsed.data.categoria ?? null
      if (parsed.data.esNuevoRegistro) {
        const organizacionSesion = ctx.organizacionDeEstablecimiento[sesion.establecimientoId]
        // Entra al lote de origen de la sesión si es de la misma especie
        const loteOrigen = sesion.loteOrigenId
          ? await tx.lote.findFirst({ where: { id: sesion.loteOrigenId, establecimientoId: sesion.establecimientoId, activo: true }, select: { id: true, especieId: true } })
          : null
        // Especie: la elegida, si no la del lote de origen, si no la del campo (nunca «bovino» a ciegas)
        const especieId = especieParaAlta({ elegida: parsed.data.especieId, lote: loteOrigen?.especieId })
          ?? await especieDelCampo(tx, sesion.establecimientoId)
        const { resultados, preparadas } = await prepararAltas([{
          fila: 1,
          sexo: parsed.data.sexo,
          caravanaVisual: parsed.data.caravanaVisual || undefined,
          caravanaRfid: eidNormalizado,
          especieId: especieId ?? undefined,
          razaId: parsed.data.razaId,
          categoriaId: parsed.data.categoriaId,
          loteId: loteOrigen && (!especieId || loteOrigen.especieId === especieId) ? loteOrigen.id : undefined,
          origen: sesion.tipo === "recepcion" ? "compra" : "cria_propia",
          fechaIngreso: sesion.fecha,
        }], { establecimientoId: sesion.establecimientoId, organizacionIds: organizacionSesion ? [organizacionSesion] : [] })
        if (!preparadas.length) {
          return NextResponse.json({ error: resultados[0]?.errores.join(". ") || "No se pudo registrar el animal" }, { status: 400 })
        }
        await insertarAltas(tx, preparadas)
        animalId = preparadas[0].animal.id as string
        if (!categoriaNombre && parsed.data.categoriaId) {
          categoriaNombre = (await tx.categoria.findUnique({ where: { id: parsed.data.categoriaId }, select: { nombre: true } }))?.nombre ?? null
        }
      }

      const item = await tx.sesionMangaItem.create({
        data: {
          sesionId: id,
          orden: nuevoOrden,
          eidLeido: eidNormalizado,
          pesoKg: parsed.data.pesoKg ?? null,
          cc: parsed.data.cc ?? null,
          denticion: parsed.data.denticion ?? null,
          resultadoTacto: parsed.data.resultadoTacto ?? null,
          mesesGestacion: parsed.data.mesesGestacion ?? null,
          accionSanidad: parsed.data.accionSanidad ?? false,
          apartadoA: parsed.data.apartadoA ?? null,
          observaciones: parsed.data.observaciones ?? null,
          animalId,
          esNuevoRegistro: parsed.data.esNuevoRegistro ?? false,
          caravanaVisual: parsed.data.caravanaVisual ?? null,
          sexo: parsed.data.sexo ?? null,
          categoria: categoriaNombre,
        },
      })
      await tx.sesionManga.update({
        where: { id },
        data: { totalAnimales: { increment: 1 } },
      })

      return NextResponse.json({ success: true, data: item }, { status: 201 })
    })
  } catch (error) {
    if (error instanceof MangaSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error al agregar item a sesión:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
