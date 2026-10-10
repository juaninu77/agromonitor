import { NextResponse } from "next/server"
import { scopeEventoAnimal } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"
import { erroresZod, mapearErrorPrisma } from "@/lib/ganado/alta"
import { BajaError, registrarBaja } from "@/lib/ganado/baja"
import { bajaSchema } from "@/lib/validations/eventos-schema"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const motivo = searchParams.get("motivo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    if (ctx.organizacionIds.length === 0) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const where: Record<string, unknown> = {
      ...scopeEventoAnimal(ctx.establecimientoIds),
    }

    if (motivo) {
      where.motivo = motivo
    }

    if (desde || hasta) {
      where.fecha = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      }
    }

    const bajas = await prisma.evtBaja.findMany({
      where: where as any,
      include: {
        animal: {
          include: {
            raza: true,
            categoria: true,
          },
        },
        cliente: true,
      },
      orderBy: { fecha: "desc" },
    })

    const data = bajas.map((baja) => ({
      ...baja,
      precioKg: decimalToNumber(baja.precioKg),
      precioTotal: decimalToNumber(baja.precioTotal),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener bajas:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// Dar de baja (venta, muerte, faena, descarte, robo, otro). Sólo admin o
// encargado de la organización dueña del animal. Comparte el servicio con
// DELETE /api/ganado/bovinos/[id].
export const POST = withAuth(
  async (request, ctx) => {
    try {
      const parsed = bajaSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        const errores = erroresZod(parsed.error)
        return NextResponse.json({ success: false, error: errores[0], errores }, { status: 400 })
      }

      const { baja, animal } = await registrarBaja(parsed.data, {
        establecimientoIds: ctx.establecimientoIdsConRol(["admin", "encargado"]),
        userId: ctx.userId,
        organizacionIds: ctx.organizacionIds,
      })

      await logAudit({
        userId: ctx.userId,
        tabla: "evt_baja",
        rowPk: baja.id,
        accion: "INSERT",
        detalle: {
          animalId: parsed.data.animalId,
          motivo: parsed.data.motivo,
          estadoVital: animal.estadoVital,
          precioTotal: parsed.data.precioTotal ?? null,
          cuentaId: parsed.data.cuentaId ?? null,
        },
        organizacionId: animal.establecimientoId
          ? ctx.organizacionDeEstablecimiento[animal.establecimientoId]
          : null,
      })

      const data = {
        ...baja,
        precioKg: decimalToNumber(baja.precioKg),
        precioTotal: decimalToNumber(baja.precioTotal),
      }

      return NextResponse.json({ success: true, data }, { status: 201 })
    } catch (error) {
      if (error instanceof BajaError) {
        return NextResponse.json({ success: false, error: error.message, codigo: error.codigo }, { status: error.status })
      }
      const conocido = mapearErrorPrisma(error)
      if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
      console.error("Error al crear baja:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
