import { withAuth } from "@/lib/api/with-auth"
import { responder } from "@/lib/api/equipo-http"
import { revocarInvitacion } from "@/lib/equipo/service"

/** Anular una invitación pendiente. */
export const DELETE = withAuth(async (_request, ctx) =>
  responder(() => revocarInvitacion(ctx, ctx.params.organizacionId, ctx.params.invitacionId)))
