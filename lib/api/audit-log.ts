import { prisma } from "@/lib/prisma"

type AuditAction = "INSERT" | "UPDATE" | "DELETE"

interface AuditLogParams {
  userId?: string | null
  tabla: string
  rowPk: string
  accion: AuditAction
  detalle?: Record<string, unknown>
  /** Organización dueña del recurso, para poder filtrar el log por tenant. */
  organizacionId?: string | null
}

export async function logAudit({
  userId,
  tabla,
  rowPk,
  accion,
  detalle,
  organizacionId,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: userId || null,
        tabla,
        rowPk,
        accion,
        detalle: detalle ? (detalle as any) : undefined,
        organizacionId: organizacionId || null,
      },
    })
  } catch (error) {
    console.error("Error al escribir audit log:", error)
  }
}
