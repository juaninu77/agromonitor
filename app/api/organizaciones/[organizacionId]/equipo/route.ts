import { withAuth } from "@/lib/api/with-auth"
import { responder } from "@/lib/api/equipo-http"
import { listarEquipo } from "@/lib/equipo/service"

/** Miembros, invitaciones pendientes (solo gestores) y campos de la organización. */
export const GET = withAuth(async (_request, ctx) => responder(() => listarEquipo(ctx, ctx.params.organizacionId)))
