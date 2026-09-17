import { withAuth } from "@/lib/api/with-auth"
import { administracionHandler, listar, guardar } from "@/lib/administracion/service"
export const GET = withAuth((request, ctx) => administracionHandler(() => listar(request, ctx)))
export const POST = withAuth((request, ctx) => administracionHandler(() => guardar(request, ctx)))
