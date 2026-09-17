import { withAuth } from "@/lib/api/with-auth"
import { administracionHandler, guardar } from "@/lib/administracion/service"
export const PATCH = withAuth((request, ctx) => administracionHandler(() => guardar(request, ctx, true)))
