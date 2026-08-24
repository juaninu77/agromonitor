// Extensión de Prisma que registra AUTOMÁTICAMENTE cada escritura en AuditLog:
// qué tabla, qué fila, qué acción, quién la hizo y el estado anterior/nuevo.
// Así ningún cambio queda sin registrar sin tener que llamar a mano en cada ruta.
//
// El "quién" sale del contexto del request (lib/api/request-context.ts).
// Escribe el log con el cliente BASE (sin extender) para no entrar en recursión.

import { Prisma, PrismaClient } from "@prisma/client"
import { getRequestContext } from "@/lib/api/request-context"
import { computarCambios, sanitizar, type Registro } from "@/lib/audit/diff"

// Modelos que no se auditan (ruido de auth y el propio log de auditoría).
const EXCLUIDOS = new Set(["AuditLog", "Session", "Account", "VerificationToken"])

const OPS_ESCRITURA = new Set([
  "create",
  "update",
  "delete",
  "upsert",
  "createMany",
  "updateMany",
  "deleteMany",
])

type Accion = "INSERT" | "UPDATE" | "DELETE"

function delegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function idDe(rec: unknown): string | null {
  if (!rec || typeof rec !== "object") return null
  const r = rec as Record<string, unknown>
  const id = r.id ?? r.animalId // Genealogia usa animalId como PK
  return id != null ? String(id) : null
}

function orgDe(rec: unknown): string | null {
  if (!rec || typeof rec !== "object") return null
  const v = (rec as Record<string, unknown>).organizacionId
  return typeof v === "string" ? v : null
}

function accionDe(operation: string, huboPrevio: boolean): Accion {
  if (operation === "delete" || operation === "deleteMany") return "DELETE"
  if (operation === "create" || operation === "createMany") return "INSERT"
  if (operation === "upsert") return huboPrevio ? "UPDATE" : "INSERT"
  return "UPDATE"
}

export function auditExtension(base: PrismaClient) {
  const delegate = (model: string) =>
    (base as unknown as Record<string, any>)[delegateKey(model)]

  async function registrar(params: {
    model: string
    operation: string
    result: any
    previos: Registro[]
    usuarioId: string | null
    ctxOrg: string | null
  }) {
    const { model, operation, result, previos, usuarioId, ctxOrg } = params

    // createMany/no-id: no hay filas individuales → log resumen.
    if (operation === "createMany") {
      await base.auditLog.create({
        data: {
          tabla: model,
          rowPk: "(varios)",
          accion: "INSERT",
          detalle: { count: result?.count ?? null } as Prisma.InputJsonValue,
          usuarioId,
          organizacionId: ctxOrg,
        },
      })
      return
    }

    // Armar la lista de (rowPk, previo, nuevo) según la operación.
    const filas: Array<{ rowPk: string | null; previo: Registro | null; nuevo: Registro | null }> = []

    if (operation === "create" || operation === "upsert") {
      filas.push({ rowPk: idDe(result), previo: previos[0] ?? null, nuevo: result ?? null })
    } else if (operation === "update") {
      filas.push({ rowPk: idDe(result) ?? idDe(previos[0]), previo: previos[0] ?? null, nuevo: result ?? null })
    } else if (operation === "delete") {
      filas.push({ rowPk: idDe(result) ?? idDe(previos[0]), previo: previos[0] ?? result ?? null, nuevo: null })
    } else if (operation === "deleteMany") {
      for (const p of previos) filas.push({ rowPk: idDe(p), previo: p, nuevo: null })
    } else if (operation === "updateMany") {
      for (const p of previos) {
        const id = idDe(p)
        const nuevo = id
          ? await delegate(model).findUnique({ where: { id } }).catch(() => null)
          : null
        filas.push({ rowPk: id, previo: p, nuevo })
      }
    }

    for (const f of filas) {
      const accion = accionDe(operation, !!f.previo)
      const cambios = accion === "UPDATE" ? computarCambios(f.previo, f.nuevo) : undefined
      const orgId = ctxOrg ?? orgDe(f.nuevo) ?? orgDe(f.previo) ?? null

      await base.auditLog.create({
        data: {
          tabla: model,
          rowPk: f.rowPk ?? "(desconocido)",
          accion,
          detalle:
            cambios && Object.keys(cambios).length
              ? ({ cambios } as Prisma.InputJsonValue)
              : undefined,
          datosPrevios: f.previo ? (sanitizar(f.previo) as Prisma.InputJsonValue) : undefined,
          datosNuevos: f.nuevo ? (sanitizar(f.nuevo) as Prisma.InputJsonValue) : undefined,
          usuarioId,
          organizacionId: orgId,
        },
      })
    }
  }

  return Prisma.defineExtension({
    name: "audit-log",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || EXCLUIDOS.has(model) || !OPS_ESCRITURA.has(operation)) {
            return query(args)
          }

          const ctx = getRequestContext()
          const usuarioId = ctx?.userId ?? null

          // Estado ANTERIOR (para update/delete/upsert) antes de aplicar el cambio.
          let previos: Registro[] = []
          try {
            const where = (args as any)?.where
            if ((operation === "update" || operation === "delete" || operation === "upsert") && where) {
              const antes = await delegate(model).findUnique({ where }).catch(() => null)
              if (antes) previos = [antes]
            } else if (operation === "updateMany" || operation === "deleteMany") {
              previos = await delegate(model).findMany({ where }).catch(() => [])
            }
          } catch {
            /* best-effort: si falla la captura previa, seguimos igual */
          }

          const result = await query(args)

          try {
            await registrar({ model, operation, result, previos, usuarioId, ctxOrg: ctx?.organizacionId ?? null })
          } catch (e) {
            // La auditoría NUNCA rompe la operación principal.
            console.error("[audit] no se pudo registrar", model, operation, e)
          }

          return result
        },
      },
    },
  })
}
