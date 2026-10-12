import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { loteDelTenant } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"
import { esSanitario } from "@/lib/inventario/validation"
import { MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"
import { hoyArgentina } from "@/lib/inventario/fechas"

const crearSesionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  tipo: z.enum(
    ["pesada", "pesada_rodeo", "sanidad", "vacunacion", "tacto", "general", "señalada", "destete", "recepcion"],
    { errorMap: () => ({ message: "Tipo de sesión inválido" }) }
  ),
  accionesHabilitadas: z.array(z.string()).min(1, "Debe habilitar al menos una acción"),
  establecimientoId: z.string().uuid("ID de establecimiento inválido"),
  loteOrigenId: z.string().uuid("ID de lote inválido").optional().nullable(),
  productoSanidadId: z.string().uuid("ID de producto inválido").optional().nullable(),
  dosisSanidad: z.number().positive("La dosis debe ser mayor a 0").max(100_000).optional().nullable(),
  unidadSanidad: z.enum(["ml", "cc", "comprimido"]).optional().nullable(),
  viaSanidad: z.enum(VIAS_SANIDAD, { errorMap: () => ({ message: "Vía inválida" }) }).optional().nullable(),
  motivoSanidad: z.enum(MOTIVOS_SANIDAD, { errorMap: () => ({ message: "Motivo inválido" }) }).optional().nullable(),
  carenciaSanidad: z.number().int().min(0, "La carencia no puede ser negativa").max(3650).optional().nullable(),
  observaciones: z.string().optional().nullable(),
})
  .refine((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || d.fecha <= hoyArgentina(), { message: "La fecha no puede ser futura", path: ["fecha"] })
  // La sanidad de la sesión necesita el producto: sin él, «Aplicar tratamiento» no registraría nada
  .refine((d) => !d.accionesHabilitadas.includes("sanidad") || !!d.productoSanidadId, { message: "Elegí el producto del tratamiento", path: ["productoSanidadId"] })

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")
    const estado = searchParams.get("estado")

    if (!establecimientoId) {
      return NextResponse.json(
        { error: "establecimientoId es requerido" },
        { status: 400 }
      )
    }

    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    // Ya validado contra ctx.establecimientoIds: la query queda scopeada al tenant
    const where: Record<string, unknown> = { establecimientoId }

    if (estado) {
      where.estado = estado
    }

    const sesiones = await prisma.sesionManga.findMany({
      where: where as any,
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
        productoSanidad: {
          select: { id: true, nombre: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: sesiones })
  } catch (error) {
    console.error("Error al obtener sesiones de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = crearSesionSchema.safeParse(body)

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

    const {
      nombre,
      fecha,
      tipo,
      accionesHabilitadas,
      establecimientoId,
      loteOrigenId,
      productoSanidadId,
      dosisSanidad,
      unidadSanidad,
      viaSanidad,
      motivoSanidad,
      carenciaSanidad,
      observaciones,
    } = parsed.data

    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    if (loteOrigenId) {
      const lote = await loteDelTenant(loteOrigenId, ctx.establecimientoIds)
      if (!lote) {
        return NextResponse.json(
          { error: "Lote no encontrado" },
          { status: 404 }
        )
      }
    }

    if (productoSanidadId) {
      // El tratamiento lo define quien puede registrar sanidad en ese campo (lo aplica cualquiera en la manga)
      if (!ctx.establecimientoIdsConRol(["admin", "encargado", "vet"]).includes(establecimientoId)) {
        return NextResponse.json(
          { error: "Solo un administrador, encargado o veterinario del campo puede definir el tratamiento de la sesión" },
          { status: 403 }
        )
      }
      const organizacionSesion = ctx.organizacionDeEstablecimiento[establecimientoId]
      // Producto de la organización o del catálogo general (este no descuenta stock)
      const producto = organizacionSesion
        ? await prisma.producto.findFirst({
            where: { id: productoSanidadId, activo: true, OR: [{ organizacionId: organizacionSesion }, { organizacionId: null }] },
            select: { tipo: true },
          })
        : null
      if (!producto || !esSanitario(producto.tipo)) {
        return NextResponse.json(
          { error: "Producto sanitario no encontrado" },
          { status: 404 }
        )
      }
    }

    const sesion = await prisma.sesionManga.create({
      data: {
        nombre,
        fecha: new Date(fecha),
        tipo,
        accionesHabilitadas,
        establecimientoId,
        operadorId: ctx.userId,
        loteOrigenId: loteOrigenId ?? null,
        productoSanidadId: productoSanidadId ?? null,
        dosisSanidad: productoSanidadId ? dosisSanidad ?? null : null,
        unidadSanidad: productoSanidadId ? unidadSanidad ?? "ml" : null,
        viaSanidad: productoSanidadId ? viaSanidad ?? null : null,
        motivoSanidad: productoSanidadId ? motivoSanidad ?? "preventivo" : null,
        carenciaSanidad: productoSanidadId ? carenciaSanidad ?? null : null,
        observaciones: observaciones ?? null,
      },
      include: {
        operador: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: sesion }, { status: 201 })
  } catch (error) {
    console.error("Error al crear sesión de manga:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
