import { handlers } from '@/auth'

/**
 * API Route para NextAuth.js
 * Maneja todas las rutas de autenticación:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/callback
 * - /api/auth/session
 * - etc.
 */
export const { GET, POST } = handlers

