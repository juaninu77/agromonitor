"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

/**
 * Provider de sesión de NextAuth
 * Envuelve la aplicación para proporcionar contexto de autenticación
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  )
}

