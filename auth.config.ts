import type { NextAuthConfig } from 'next-auth'

/**
 * Configuración de NextAuth.js v5
 * Define las rutas públicas y privadas de la aplicación
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      
      // Rutas que requieren autenticación (todo excepto login/register)
      const isProtectedRoute = !nextUrl.pathname.startsWith('/login') && 
                               !nextUrl.pathname.startsWith('/register') &&
                               !nextUrl.pathname.startsWith('/api/auth')
      
      // Si está en ruta protegida y no está logueado, redirigir a login
      if (isProtectedRoute && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl))
      }
      
      // Si está logueado e intenta ir a login/register, redirigir a dashboard
      if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/register')) {
        return Response.redirect(new URL('/', nextUrl))
      }
      
      return true
    },
    jwt({ token, user }) {
      // Agregar datos del usuario al token JWT
      if (user) {
        token.id = user.id
        token.email = user.email
        token.nombre = user.nombre
        token.apellido = user.apellido
        token.rol = user.rol
      }
      return token
    },
    session({ session, token }) {
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

