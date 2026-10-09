import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEventoAnimal } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"
import { errorSanidad, registrarSanidad } from "@/lib/sanidad/service"

// ============================================
// POST /api/ganado/eventos-sanitarios
// ============================================
// Registro rápido desde Ganado y la ficha del animal. Usa el mismo servicio que
// Sanidad (roles, validaciones, auditoría y descuento de stock); acepta los nombres
// de campo anteriores (bovinoId, tipoEvento, descripcion).

const MOTIVO_POR_TIPO: Record<string, string> = { vacunacion: "preventivo", desparasitacion: "preventivo", tratamiento: "curativo", curacion: "curativo" }
const TIPO_LABEL: Record<string, string> = { vacunacion: "Vacunación", desparasitacion: "Desparasitación", tratamiento: "Tratamiento", curacion: "Curación" }

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = (await req.json().catch(() => null)) ?? {}
    if (!body.productoId) {
      return NextResponse.json({ success: false, error: "Elegí el producto aplicado del inventario" }, { status: 400 })
    }
    const { bovinoId, tipoEvento, descripcion, producto: _producto, ...resto } = body
    const observ = [TIPO_LABEL[tipoEvento], descripcion].filter(Boolean).join(" · ") || null
    const data = await registrarSanidad(ctx, {
      ...resto,
      animalId: body.animalId ?? bovinoId,
      // Los formularios rápidos piden la dosis en ml
      unidad: body.unidad ?? (body.dosis ? "ml" : null),
      motivo: body.motivo ?? MOTIVO_POR_TIPO[tipoEvento] ?? null,
      observ: body.observ ?? observ,
    })
    return NextResponse.json({ success: true, data, message: "Evento sanitario registrado exitosamente" }, { status: 201 })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al crear evento sanitario:", error)
    return NextResponse.json({ success: false, error: "Error al registrar el evento sanitario" }, { status: 500 })
  }
})

// ============================================
// GET /api/ganado/eventos-sanitarios?animalId=
// ============================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url)
    const animalId = searchParams.get("bovinoId") || searchParams.get("animalId")

    if (!animalId) {
      return NextResponse.json({ success: false, error: "Se requiere el ID del animal" }, { status: 400 })
    }

    const eventos = await prisma.evtSanidad.findMany({
      where: {
        animalId,
        ...scopeEventoAnimal(ctx.establecimientoIds),
      },
      include: { producto: true },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: eventos.map((e) => ({ ...e, costo: e.costo ? Number(e.costo) : null })),
    })
  } catch (error) {
    console.error("Error al obtener eventos sanitarios:", error)
    return NextResponse.json(
      { success: false, error: "Error al obtener los eventos sanitarios" },
      { status: 500 }
    )
  }
})
