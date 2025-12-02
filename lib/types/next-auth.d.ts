import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

/**
 * Extender los tipos de NextAuth para incluir campos personalizados
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      nombre: string
      apellido: string
      rol: string
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    id: string
    nombre: string
    apellido: string
    rol: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    nombre: string
    apellido: string
    rol: string
  }
}

