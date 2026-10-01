import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { resetPasswordApiSchema } from "@/lib/validations/auth-schema"

export async function POST(request: Request) {
  try {
    const parsed = resetPasswordApiSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      )
    }

    const { token, email, password } = parsed.data

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

    const user = await prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
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
