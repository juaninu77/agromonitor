import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'

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
        console.log('🔐 Intentando autenticar...')
        
        // Validar que se proporcionaron las credenciales
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Credenciales vacías')
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        console.log('📧 Email recibido:', email)

        try {
          // Buscar usuario por email
          const user = await prisma.usuario.findUnique({
            where: { email },
          })
          console.log('👤 Usuario encontrado:', user ? 'Sí' : 'No')

          // Si no existe el usuario
          if (!user) {
            console.log('❌ Usuario no encontrado:', email)
            return null
          }

          console.log('📝 Usuario data:', { id: user.id, email: user.email, esActivo: user.esActivo })

          // Verificar si el usuario está activo
          if (!user.esActivo) {
            console.log('❌ Usuario inactivo:', email)
            return null
          }

          if (!user.passwordHash) {
            console.log('❌ Usuario sin contraseña configurada:', email)
            return null
          }

          console.log('🔑 Comparando contraseña...')
          const passwordMatch = await bcrypt.compare(password, user.passwordHash)
          console.log('🔑 Contraseña coincide:', passwordMatch)

          if (!passwordMatch) {
            console.log('❌ Contraseña incorrecta para:', email)
            return null
          }

          console.log('✅ Autenticación exitosa para:', email)

          // Retornar el usuario (sin la contraseña)
          return {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            apellido: user.apellido,
            rol: user.rol,
          }
        } catch (error) {
          console.error('❌ Error en autenticación:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.AUTH_SECRET,
})

