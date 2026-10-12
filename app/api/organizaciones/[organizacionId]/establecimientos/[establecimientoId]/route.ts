import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"

const texto = z.string().trim().max(200).nullish().transform((v) => (v === undefined ? undefined : v || null))
const edicionSchema = z.object({
  nombre: z.string({ invalid_type_error: "El nombre es requerido" }).trim().min(1, "El nombre es requerido").max(120).optional(),
  hectareas: z.number({ invalid_type_error: "Las hectáreas deben ser un número positivo" }).positive("Las hectáreas deben ser un número positivo").max(10_000_000).nullish(),
  renspa: texto,
  provincia: texto,
  localidad: texto,
  ubicacion: texto,
})

// ============================================
// PATCH /api/organizaciones/[organizacionId]/establecimientos/[establecimientoId]
// ============================================
// Edita los datos de un campo: solo el administrador (propietario/administrador) de su organización

export const PATCH = withAuth(async (request, ctx) => {
  try {
    const { organizacionId, establecimientoId } = ctx.params
    if (!ctx.organizacionIdsConRol(["admin"]).includes(organizacionId)) {
      return NextResponse.json({ error: "No tienes permisos para editar establecimientos" }, { status: 403 })
    }
    const actual = await prisma.establecimiento.findFirst({ where: { id: establecimientoId, organizacionId }, select: { id: true } })
    if (!actual) return NextResponse.json({ error: "Establecimiento no encontrado" }, { status: 404 })

    const parsed = edicionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 })
    // Los campos ausentes no se tocan
    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))
    if (!Object.keys(data).length) return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 })

    const establecimiento = await prisma.establecimiento.update({ where: { id: establecimientoId }, data })
    await logAudit({ userId: ctx.userId, organizacionId, tabla: "establecimientos", rowPk: establecimientoId, accion: "UPDATE", detalle: data })
    return NextResponse.json(establecimiento)
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un establecimiento con ese nombre en esta organización" }, { status: 409 })
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    console.error("Error al editar establecimiento:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
})
