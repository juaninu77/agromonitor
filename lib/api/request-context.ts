// Contexto por request (quién está haciendo la operación), disponible en
// cualquier punto del árbol de llamadas sin pasarlo por parámetros.
// Lo usa la extensión de auditoría de Prisma para saber QUIÉN hizo cada cambio.

import { AsyncLocalStorage } from "node:async_hooks"

export interface RequestContext {
  userId?: string | null
  /** Organización activa del request, si se puede determinar. */
  organizacionId?: string | null
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

/** Devuelve el contexto del request actual (o undefined fuera de un request). */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}

/** Ejecuta `fn` con el contexto dado; todo lo que corra dentro lo ve. */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn)
}
