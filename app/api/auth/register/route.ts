import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerApiSchema } from '@/lib/validations/auth-schema'

const ERROR_EMAIL_DUPLICADO = 'Ya existe una cuenta con este email. Iniciá sesión o recuperá tu contraseña.'

function slugOrganizacion(nombre: string, apellido: string): string {
  const base = `${nombre}-${apellido}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return `${base || 'organizacion'}-${Date.now().toString(36)}`
}

/**
 * API Route para registro de nuevos usuarios
 * POST /api/auth/register
 *
 * Crea en una transacción: usuario + organización + membresía (propietario)
 * + establecimiento inicial. El usuario completa los datos en el onboarding.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const parsed = registerApiSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const primerError = Object.values(fieldErrors).flat()[0]
    return NextResponse.json(
      { error: primerError ?? 'Datos inválidos', fieldErrors },
      { status: 400 }
    )
  }

  const { email, password, nombre, apellido, telefono } = parsed.data

  try {
    // Sin distinguir mayúsculas: hay cuentas anteriores a la normalización del email
    const existingUser = await prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: ERROR_EMAIL_DUPLICADO, fieldErrors: { email: [ERROR_EMAIL_DUPLICADO] } },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          email,
          passwordHash,
          nombre,
          apellido,
          telefono: telefono ?? null,
          rol: 'usuario',
          esActivo: true,
        },
      })

      const organizacion = await tx.organizacion.create({
        data: {
          nombre: `Organización ${apellido}`,
          slug: slugOrganizacion(nombre, apellido),
        },
      })

      await tx.membresia.create({
        data: {
          usuarioId: user.id,
          organizacionId: organizacion.id,
          rol: 'propietario',
        },
      })

      await tx.establecimiento.create({
        data: {
          nombre: 'Establecimiento Principal',
          hectareas: 100,
          organizacionId: organizacion.id,
          provincia: 'Buenos Aires',
        },
      })

      return user
    })

    return NextResponse.json(
      {
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
        },
        necesitaConfiguracion: true, // Debe completar el onboarding
      },
      { status: 201 }
    )
  } catch (error) {
    // Carrera entre dos registros simultáneos con el mismo email
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: ERROR_EMAIL_DUPLICADO, fieldErrors: { email: [ERROR_EMAIL_DUPLICADO] } },
        { status: 409 }
      )
    }

    console.error('[register] Error creando la cuenta:', error)

    const esErrorDeBase =
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021')

    return NextResponse.json(
      {
        error: esErrorDeBase
          ? 'El servicio no está disponible en este momento. Intentá de nuevo más tarde.'
          : 'No pudimos crear la cuenta. Intentá de nuevo.',
      },
      { status: esErrorDeBase ? 503 : 500 }
    )
  }
}
