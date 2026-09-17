import { withAuth } from "@/lib/api/with-auth"
import { administracionHandler, descargar } from "@/lib/administracion/service"
export const GET = withAuth((request, ctx) => administracionHandler(() => descargar(request, ctx)))
