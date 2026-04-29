import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "El email es requerido" },
        { status: 400 }
      )
    }

    const user = await prisma.usuario.findUnique({
      where: { email },
    })

    // Siempre responder igual para no revelar si el email existe
    if (!user || !user.esActivo) {
      return NextResponse.json({
        message:
          "Si el email esta registrado, recibiras instrucciones para restablecer tu contrasena",
      })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    // Borrar tokens anteriores del mismo email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `reset:${email}` },
    })

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token,
        expires,
      },
    })

    // En produccion aca enviarias el email con el link:
    // https://tudominio.com/reset-password?token=TOKEN&email=EMAIL
    console.log(
      `[Reset Password] Token generado para ${email}: ${token}`
    )
    console.log(
      `[Reset Password] Link: /reset-password?token=${token}&email=${encodeURIComponent(email)}`
    )

    return NextResponse.json({
      message:
        "Si el email esta registrado, recibiras instrucciones para restablecer tu contrasena",
      // Solo en desarrollo, mostrar el token para testing
      ...(process.env.NODE_ENV === "development" ? { _devToken: token } : {}),
    })
  } catch (error) {
    console.error("Error en forgot-password:", error)
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    )
  }
}
