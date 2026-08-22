import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { animalDelTenant, scopeEventoAnimal } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

const createEventoSchema = z.object({
  bovinoId: z.string().uuid("ID de animal inválido"),
  tipoEvento: z.enum(["vacunacion", "desparasitacion", "tratamiento", "curacion", "otro"]),
  descripcion: z.string().min(1, "La descripción es requerida"),
  fecha: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Fecha inválida",
  }),
  producto: z.string().optional(),
  dosis: z.string().optional(),
  veterinario: z.string().optional(),
})

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json()
    const validatedData = createEventoSchema.parse(body)

    const animal = await animalDelTenant(
      validatedData.bovinoId,
      ctx.establecimientoIds
    )

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    let productoId: string | undefined

    if (validatedData.producto) {
      const producto = await prisma.producto.findFirst({
        where: {
          OR: [
            { nombre: { contains: validatedData.producto, mode: "insensitive" } },
            { id: validatedData.producto },
          ],
        },
      })
      productoId = producto?.id
    }

    if (!productoId) {
      const productoGenerico = await prisma.producto.findFirst({
        where: { tipo: "otro" },
      })
      if (productoGenerico) {
        productoId = productoGenerico.id
      } else {
        const nuevo = await prisma.producto.create({
          data: {
            nombre: validatedData.producto || validatedData.descripcion,
            tipo: "otro",
          },
        })
        productoId = nuevo.id
      }
    }

    const evento = await prisma.evtSanidad.create({
      data: {
        animalId: validatedData.bovinoId,
        fecha: new Date(validatedData.fecha),
        motivo: validatedData.tipoEvento === "vacunacion" || validatedData.tipoEvento === "desparasitacion"
          ? "preventivo"
          : "curativo",
        dosis: validatedData.dosis ? parseFloat(validatedData.dosis) || null : null,
        veterinario: validatedData.veterinario,
        observ: validatedData.descripcion,
        productoId: productoId,
      },
    })

    return NextResponse.json({
      success: true,
      data: evento,
      message: "Evento sanitario registrado exitosamente",
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error al crear evento sanitario:", error)
    return NextResponse.json(
      { error: error.message || "Error al registrar el evento sanitario" },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url)
    const animalId = searchParams.get("bovinoId") || searchParams.get("animalId")

    if (!animalId) {
      return NextResponse.json(
        { error: "Se requiere el ID del animal" },
        { status: 400 }
      )
    }

    const eventos = await prisma.evtSanidad.findMany({
      where: {
        animalId,
        ...scopeEventoAnimal(ctx.establecimientoIds),
      },
      include: { producto: true },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: eventos })
  } catch (error: any) {
    console.error("Error al obtener eventos sanitarios:", error)
    return NextResponse.json(
      { error: error.message || "Error al obtener los eventos sanitarios" },
      { status: 500 }
    )
  }
})
