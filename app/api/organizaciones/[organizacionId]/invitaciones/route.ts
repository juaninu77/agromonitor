import { withAuth } from "@/lib/api/with-auth"
import { origenPublico, responder } from "@/lib/api/equipo-http"
import { invitar } from "@/lib/equipo/service"

/** Invitar por email con rol y acceso a campos. Devuelve el enlace (se muestra una sola vez). */
export const POST = withAuth(async (request, ctx) =>
  responder(async () => invitar(ctx, ctx.params.organizacionId, await request.json(), origenPublico(request)), 201))
