import { NextResponse } from "next/server"
import { scopeOrganizacion } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (_request, ctx) => {
  try {
    if (ctx.organizacionIds.length === 0) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const clientes = await prisma.cliente.findMany({
      where: scopeOrganizacion(ctx.organizacionIds),
      include: {
        _count: { select: { ventas: true } },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: clientes })
  } catch (error) {
    console.error("Error al obtener clientes:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    if (ctx.organizacionIds.length === 0) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const body = await request.json()

    if (!body.nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    let organizacionId: string
    if (body.organizacionId) {
      if (!ctx.organizacionIds.includes(body.organizacionId)) {
        return NextResponse.json(
          { error: "No tienes acceso a esa organización" },
          { status: 403 }
        )
      }
      organizacionId = body.organizacionId
    } else if (ctx.organizacionIds.length === 1) {
      organizacionId = ctx.organizacionIds[0]
    } else {
      return NextResponse.json(
        { error: "Debe indicar organizacionId" },
        { status: 400 }
      )
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre: body.nombre,
        cuit: body.cuit || null,
        tipo: body.tipo || [],
        renspa: body.renspa || null,
        contactoNombre: body.contactoNombre || null,
        contactoTel: body.contactoTel || null,
        notas: body.notas || null,
        organizacionId,
      },
    })

    return NextResponse.json({ success: true, data: cliente }, { status: 201 })
  } catch (error) {
    console.error("Error al crear cliente:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
