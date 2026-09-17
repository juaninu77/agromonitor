import type { NextAuthConfig } from 'next-auth'


/**
 * Configuración de NextAuth.js v5
 * Define las rutas públicas y privadas de la aplicación
 */

// Regex para validar UUIDs v4
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Valida si un string es un UUID válido
 */
function isValidUUID(id: string | unknown): boolean {
  if (typeof id !== 'string') return false
  return UUID_REGEX.test(id)
}

export const authConfig = {
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isApiRoute = nextUrl.pathname.startsWith('/api/')
      const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')

      const isProtectedRoute = !nextUrl.pathname.startsWith('/login') &&
                               !nextUrl.pathname.startsWith('/register') &&
                               !nextUrl.pathname.startsWith('/forgot-password') &&
                               !nextUrl.pathname.startsWith('/reset-password') &&
                               !isAuthRoute

      if (isProtectedRoute && !isLoggedIn) {
        if (isApiRoute) {
          return Response.json({ error: "No autenticado" }, { status: 401 })
        }
        return Response.redirect(new URL('/login', nextUrl))
      }

      if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/register' || nextUrl.pathname === '/forgot-password' || nextUrl.pathname === '/reset-password')) {
        return Response.redirect(new URL('/', nextUrl))
      }

      return true
    },

    async jwt({ token, user }) {
      // Si hay nuevo login, usar esos datos directamente
      if (user) {
        token.id = user.id
        token.email = user.email
        token.nombre = user.nombre
        token.apellido = user.apellido
        token.rol = user.rol
        return token
      }

      // El middleware Edge no consulta Prisma. Un token inválido requiere nuevo login.
      if (!isValidUUID(token.id)) return null

      return token
    },

    session({ session, token }) {
      // VALIDACIÓN FINAL: Verificar que el ID sea UUID válido antes de crear sesión
      if (!token.id || !isValidUUID(token.id)) {
        console.error('❌ Sesión inválida: ID no es UUID válido:', token.id)
        // Invalidar sesión retornando null
        return null as any
      }

      // Agregar datos del token a la sesión
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.nombre = token.nombre as string
        session.user.apellido = token.apellido as string
        session.user.rol = token.rol as string
      }

      return session
    },
  },
  providers: [], // Se configuran en auth.ts
} satisfies NextAuthConfig

