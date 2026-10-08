import { withAuth } from "@/lib/api/with-auth"
import { responder } from "@/lib/api/equipo-http"
import { actualizarMiembro, quitarMiembro } from "@/lib/equipo/service"

/** Cambiar rol, acceso a campos o activar/desactivar a un miembro. */
export const PATCH = withAuth(async (request, ctx) =>
  responder(async () => actualizarMiembro(ctx, ctx.params.organizacionId, ctx.params.membresiaId, await request.json())))

/** Quitar a un miembro (o salir de la organización si es la propia membresía). */
export const DELETE = withAuth(async (_request, ctx) =>
  responder(() => quitarMiembro(ctx, ctx.params.organizacionId, ctx.params.membresiaId)))
