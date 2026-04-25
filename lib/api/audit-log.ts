import { prisma } from "@/lib/prisma"

type AuditAction = "INSERT" | "UPDATE" | "DELETE"

interface AuditLogParams {
  userId?: string | null
  tabla: string
  rowPk: string
  accion: AuditAction
  detalle?: Record<string, unknown>
}

export async function logAudit({
  userId,
  tabla,
  rowPk,
  accion,
  detalle,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: userId || null,
        tabla,
        rowPk,
        accion,
        detalle: detalle ? (detalle as any) : undefined,
      },
    })
  } catch (error) {
    console.error("Error al escribir audit log:", error)
  }
}
