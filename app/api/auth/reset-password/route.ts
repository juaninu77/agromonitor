import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Token, email y nueva contrasena son requeridos" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 6 caracteres" },
        { status: 400 }
      )
    }

    // Buscar el token de verificacion
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `reset:${email}`,
        token,
      },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: "El enlace de recuperacion no es valido" },
        { status: 400 }
      )
    }

    if (verificationToken.expires < new Date()) {
      // Limpiar token expirado
      await prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${email}`, token },
      })
      return NextResponse.json(
        { error: "El enlace de recuperacion ha expirado. Solicita uno nuevo." },
        { status: 400 }
      )
    }

    const user = await prisma.usuario.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${email}` },
      }),
    ])

    return NextResponse.json({
      message: "Contrasena actualizada exitosamente",
    })
  } catch (error) {
    console.error("Error en reset-password:", error)
    return NextResponse.json(
      { error: "Error al restablecer la contrasena" },
      { status: 500 }
    )
  }
}
