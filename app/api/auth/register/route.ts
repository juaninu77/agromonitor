import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * API Route para registro de nuevos usuarios
 * POST /api/auth/register
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, nombre, apellido, telefono } = body

    // Validaciones básicas
    if (!email || !password || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'El formato del email no es válido' },
        { status: 400 }
      )
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Verificar si el email ya está registrado
    const existingUser = await prisma.usuario.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este email' },
        { status: 409 }
      )
    }

    // Encriptar la contraseña
    const passwordHash = await bcrypt.hash(password, 12)

    // Generar slug único para la organización
    const baseSlug = `${nombre.toLowerCase()}-${apellido.toLowerCase()}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    // Crear usuario, organización, membresía y campo en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el usuario
      const user = await tx.usuario.create({
        data: {
          email,
          passwordHash,
          nombre,
          apellido,
          telefono: telefono || null,
          rol: 'usuario',
          esActivo: true,
        },
      })

      // 2. Crear organización por defecto
      const organizacion = await tx.organizacion.create({
        data: {
          nombre: `Organización ${apellido}`,
          slug,
        },
      })

      // 3. Crear membresía como propietario
      await tx.membresia.create({
        data: {
          usuarioId: user.id,
          organizacionId: organizacion.id,
          rol: 'propietario',
        },
      })

      // 4. Crear establecimiento de ejemplo
      await tx.establecimiento.create({
        data: {
          nombre: 'Establecimiento Principal',
          hectareas: 100,
          organizacionId: organizacion.id,
          provincia: 'Buenos Aires',
        },
      })

      return {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
        createdAt: user.createdAt,
      }
    })

    return NextResponse.json(
      { 
        message: 'Usuario creado exitosamente',
        user: result 
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}

