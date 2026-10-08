// Cuenta del usuario logueado: perfil, contraseña y espacios (organizaciones) a los que pertenece.

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { EquipoError, misInvitaciones } from "@/lib/equipo/service"
import { normalizarRolOrg } from "@/lib/equipo/roles"
import { passwordSchema } from "@/lib/validations/auth-schema"

export const perfilSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá tu nombre").max(80),
  apellido: z.string().trim().min(1, "Ingresá tu apellido").max(80),
  telefono: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, "El teléfono solo puede contener números, espacios, +, ( ) y -").nullish().transform((v) => v || null),
}).strict()

export const cambioPasswordSchema = z.object({
  actual: z.string().min(1, "Ingresá tu contraseña actual").max(200),
  nueva: passwordSchema,
}).strict().refine((v) => v.actual !== v.nueva, { message: "La nueva contraseña tiene que ser distinta", path: ["nueva"] })

export async function miCuenta(usuarioId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true, nombre: true, apellido: true, email: true, telefono: true, emailVerificado: true, createdAt: true,
      membresias: {
        where: { organizacion: { esActivo: true } },
        include: { organizacion: { select: { id: true, nombre: true, _count: { select: { establecimientos: true, membresias: { where: { esActivo: true } } } } } }, _count: { select: { establecimientosAcceso: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!u) throw new EquipoError("Cuenta no encontrada", 404)
  const { membresias, emailVerificado, ...perfil } = u
  return {
    perfil: { ...perfil, emailVerificado: !!emailVerificado },
    espacios: membresias.map((m) => ({
      membresiaId: m.id,
      organizacionId: m.organizacion.id,
      nombre: m.organizacion.nombre,
      rol: normalizarRolOrg(m.rol),
      esActivo: m.esActivo,
      campos: m.accesoTotal ? m.organizacion._count.establecimientos : m._count.establecimientosAcceso,
      accesoTotal: m.accesoTotal,
      miembros: m.organizacion._count.membresias,
    })),
    invitaciones: (await misInvitaciones({ email: u.email })).map((i) => ({ ...i, aceptarSinEnlace: !!emailVerificado })),
  }
}

export async function actualizarPerfil(usuarioId: string, raw: unknown) {
  const v = perfilSchema.parse(raw)
  return prisma.usuario.update({ where: { id: usuarioId }, data: v, select: { nombre: true, apellido: true, telefono: true } })
}

export async function cambiarPassword(usuarioId: string, raw: unknown) {
  const v = cambioPasswordSchema.parse(raw)
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { passwordHash: true } })
  if (!u?.passwordHash || !(await bcrypt.compare(v.actual, u.passwordHash))) throw new EquipoError("La contraseña actual no es correcta", 400)
  await prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash: await bcrypt.hash(v.nueva, 12) } })
  return { ok: true }
}
