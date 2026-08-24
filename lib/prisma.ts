import { PrismaClient } from '@prisma/client'
import { auditExtension } from '@/lib/audit/audit-extension'

// PrismaClient se guarda en `global` en desarrollo para no agotar el pool de
// conexiones. El cliente exportado va EXTENDIDO con la auditoría automática;
// la extensión usa el cliente base (sin extender) para escribir el log.

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
  prisma: ReturnType<typeof crearClienteAuditado> | undefined
}

function crearClienteAuditado() {
  const base =
    globalForPrisma.prismaBase ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

  return base.$extends(auditExtension(base))
}

export const prisma = globalForPrisma.prisma ?? crearClienteAuditado()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
