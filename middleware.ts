import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

/**
 * Middleware de Next.js
 * Protege las rutas según la configuración de NextAuth
 * 
 * Funcionamiento:
 * - Rutas públicas: /login, /register, /api/auth/*
 * - Rutas protegidas: Todas las demás (requieren autenticación)
 */
export default NextAuth(authConfig).auth

export const config = {
  // Rutas que pasan por el middleware
  // Excluye archivos estáticos y assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

