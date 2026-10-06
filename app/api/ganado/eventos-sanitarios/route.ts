import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { withAuth } from "@/lib/api/with-auth"
import { animalDelTenant, scopeEventoAnimal } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { erroresZod, mapearErrorPrisma } from "@/lib/ganado/alta"
import { eventoSanitarioSchema } from "@/lib/validations/eventos-schema"

// ============================================
// POST /api/ganado/eventos-sanitarios
// ============================================
// Registra un evento sanitario individual. Sólo admin, encargado o vet de
// la organización dueña del animal. El producto puede venir por id
// (catálogo de la org o global) o por nombre (se crea en la org si no existe).

const ROLES_SANIDAD = ["admin", "encargado", "vet"] as const

export const POST = withAuth(
  async (req, ctx) => {
    try {
      const parsed = eventoSanitarioSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) {
        const errores = erroresZod(parsed.error)
        return NextResponse.json({ success: false, error: errores[0], errores }, { status: 400 })
      }
      const data = parsed.data

      // Sólo entre los establecimientos donde el usuario tiene rol sanitario
      const animal = await animalDelTenant(data.animalId, ctx.establecimientoIdsConRol([...ROLES_SANIDAD]))
      if (!animal) {
        return NextResponse.json({ success: false, error: "Animal no encontrado" }, { status: 404 })
      }
      if (animal.estadoVital !== "activo") {
        return NextResponse.json(
          { success: false, error: "No se pueden registrar eventos sanitarios de un animal dado de baja" },
          { status: 400 }
        )
      }

      const organizacionId = ctx.organizacionDeEstablecimiento[animal.establecimientoId!]
      if (!organizacionId) {
        return NextResponse.json(
          { success: false, error: "No se pudo determinar la organización del animal" },
          { status: 400 }
        )
      }

      // Producto: por id (org o global) o por nombre (insensible a mayúsculas)
      const nombreProducto = data.producto ?? (data.productoId ? undefined : "Evento sin producto informado")
      const productoExistente = await prisma.producto.findFirst({
        where: {
          OR: [{ organizacionId }, { organizacionId: null }],
          ...(data.productoId ? { id: data.productoId } : { nombre: { equals: nombreProducto, mode: "insensitive" } }),
        },
        orderBy: { organizacionId: { sort: "desc", nulls: "last" } },
      })
      if (data.productoId && !productoExistente) {
        return NextResponse.json(
          { success: false, error: "Producto no encontrado en la organización del animal" },
          { status: 400 }
        )
      }

      const motivo =
        data.tipoEvento === "vacunacion" || data.tipoEvento === "desparasitacion" ? "preventivo" : "curativo"

      const evento = await prisma.$transaction(async (tx) => {
        let producto = productoExistente
        if (!producto) {
          try {
            producto = await tx.producto.create({ data: { nombre: nombreProducto!, tipo: "otro", organizacionId } })
          } catch (error) {
            // Carrera: otro request creó el mismo producto (índice único por org + nombre)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
              producto = await tx.producto.findFirstOrThrow({
                where: { organizacionId, nombre: { equals: nombreProducto, mode: "insensitive" } },
              })
            } else {
              throw error
            }
          }
        }
        return tx.evtSanidad.create({
          data: {
            animalId: data.animalId,
            fecha: data.fecha,
            motivo,
            dosis: data.dosis ?? null,
            unidad: data.unidad ?? null,
            via: data.via ?? null,
            veterinario: data.veterinario ?? null,
            costo: data.costo ?? null,
            observ: data.descripcion ?? null,
            productoId: producto.id,
          },
          include: { producto: { select: { id: true, nombre: true } } },
        })
      })

      await logAudit({
        userId: ctx.userId,
        tabla: "evt_sanidad",
        rowPk: evento.id,
        accion: "INSERT",
        detalle: { animalId: data.animalId, productoId: evento.productoId, tipoEvento: data.tipoEvento },
        organizacionId,
      })

      return NextResponse.json(
        { success: true, data: { ...evento, costo: evento.costo ? Number(evento.costo) : null }, message: "Evento sanitario registrado exitosamente" },
        { status: 201 }
      )
    } catch (error) {
      const conocido = mapearErrorPrisma(error)
      if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
      console.error("Error al crear evento sanitario:", error)
      return NextResponse.json(
        { success: false, error: "Error al registrar el evento sanitario" },
        { status: 500 }
      )
    }
  },
  { roles: [...ROLES_SANIDAD] }
)

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
