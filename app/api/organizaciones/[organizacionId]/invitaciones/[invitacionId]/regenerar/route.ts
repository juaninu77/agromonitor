import { withAuth } from "@/lib/api/with-auth"
import { origenPublico, responder } from "@/lib/api/equipo-http"
import { regenerarInvitacion } from "@/lib/equipo/service"

/** Nuevo enlace para una invitación pendiente (el anterior deja de servir). */
export const POST = withAuth(async (request, ctx) =>
  responder(() => regenerarInvitacion(ctx, ctx.params.organizacionId, ctx.params.invitacionId, origenPublico(request))))
