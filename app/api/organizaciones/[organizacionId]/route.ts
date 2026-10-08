import { withAuth } from "@/lib/api/with-auth"
import { responder } from "@/lib/api/equipo-http"
import { renombrarOrganizacion } from "@/lib/equipo/service"

/** Renombrar la organización (propietario o administrador). */
export const PATCH = withAuth(async (request, ctx) =>
  responder(async () => renombrarOrganizacion(ctx, ctx.params.organizacionId, await request.json())))
