import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AUTH_ERROR_CODES, loginSchema } from '@/lib/validations/auth-schema'
import { authConfig } from './auth.config'

class CredencialesInvalidasError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.CREDENCIALES_INVALIDAS
}

class CuentaInactivaError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.CUENTA_INACTIVA
}

class ServicioNoDisponibleError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.SERVICIO_NO_DISPONIBLE
}

// Hash descartable: si el email no existe igual se ejecuta bcrypt.compare,
// así el tiempo de respuesta no revela qué emails están registrados.
const HASH_FICTICIO = '$2b$12$AqSDQvjIkG37t4v3i8rRTuvOZQVnk4MXYpWPd4GzFP/UQS6tVgpBq'

/**
 * Configuración completa de NextAuth.js v5
 * Incluye el provider de Credentials para login con email/password
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) throw new CredencialesInvalidasError()

        const { email, password } = parsed.data

        let user
        try {
          // Búsqueda sin distinguir mayúsculas: hay cuentas creadas antes de
          // que el registro normalizara el email a minúsculas.
          user = await prisma.usuario.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          })
        } catch (error) {
          console.error('[auth] Error consultando usuario:', error)
          throw new ServicioNoDisponibleError()
        }

        const passwordMatch = await bcrypt.compare(password, user?.passwordHash ?? HASH_FICTICIO)

        if (!user || !user.passwordHash || !passwordMatch) {
          throw new CredencialesInvalidasError()
        }

        // Solo se informa "inactiva" a quien conoce la contraseña
        if (!user.esActivo) throw new CuentaInactivaError()

        return {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
})
