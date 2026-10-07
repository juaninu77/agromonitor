import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { crearMovimiento, finanzasHandler, listarMovimientos, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { filtroMovimientosSchema, movimientoSchema } from "@/lib/finanzas/validation"

// GET /api/finanzas/movimientos?establecimientoId=&cuentaId=&tipo=&categoria=&desde=&hasta=&q=&page=&limit=
export const GET = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const params = Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== ""))
      const filtro = filtroMovimientosSchema.parse(params)
      const resultado = await listarMovimientos(ctx, filtro)
      return NextResponse.json({ success: true, ...resultado }, { headers: { "Cache-Control": "private, no-store" } })
    }),
  { roles: [...ROLES_FINANZAS] },
)

// POST /api/finanzas/movimientos — ingreso o egreso (admin o encargado del campo)
export const POST = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const input = movimientoSchema.parse(await request.json())
      const data = await crearMovimiento(ctx, input)
      return NextResponse.json({ success: true, data }, { status: 201 })
    }),
  { roles: [...ROLES_FINANZAS] },
)
