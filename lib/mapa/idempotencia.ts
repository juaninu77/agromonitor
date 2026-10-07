// Idempotencia de las operaciones que la cola sin conexión del mapa puede
// reenviar (movimientos de animales, mediciones de pasto). El dispositivo
// genera la clave; si la operación ya se registró, se devuelve el mismo
// resultado en lugar de repetirla.

import type { Prisma } from "@prisma/client"
import { MapError } from "./api"

export async function conClave<T>(
  tx: Prisma.TransactionClient,
  op: { clave?: string | null; usuarioId: string; ruta: string },
  fn: () => Promise<T>,
): Promise<T> {
  if (!op.clave) return fn()
  const prior = await tx.operacionIdempotente.findUnique({ where: { clave: op.clave } })
  if (prior) {
    if (prior.usuarioId !== op.usuarioId || prior.ruta !== op.ruta) throw new MapError("La clave de operación ya fue utilizada en otra operación", 409)
    return prior.resultado as T
  }
  const resultado = await fn()
  await tx.operacionIdempotente.create({ data: { clave: op.clave, usuarioId: op.usuarioId, ruta: op.ruta, resultado: JSON.parse(JSON.stringify(resultado)) } })
  return resultado
}
